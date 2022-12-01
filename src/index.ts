import * as dotenv from 'dotenv'
import express from 'express'
import SpotifyWebApi from 'spotify-web-api-node'
dotenv.config()

const playlists = [
  {
    explicit: '0IgKQYNz8bXHWda74ZtJvU',
    clean: '3vPcyeQqqeJcDZ5rvQB2HG',
  },
]

const scopes = ['playlist-modify-private', 'playlist-modify-public']

const spotifyAPI = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: 'http://localhost:8888/callback',
})

const app = express()

app.get('/login', (_req, res) => {
  res.redirect(spotifyAPI.createAuthorizeURL(scopes, 'state'))
})

app.get('/callback', (req, res) => {
  const { error, code } = req.query

  if (error) {
    console.error('Callback Error: ', error)
    res.send(`Callback Error: ${error}`)
    return
  }

  spotifyAPI
    .authorizationCodeGrant(<string>code)
    .then((data) => {
      const access_token = data.body['access_token']
      // console.log('Access Token: ', access_token)
      spotifyAPI.setAccessToken(access_token)

      const refresh_token = data.body['refresh_token']
      // console.log('Refresh Token: ', refresh_token)
      spotifyAPI.setRefreshToken(refresh_token)

      const expires_in = data.body['expires_in']
      // console.log(`Access Token Expires In ${expires_in}s`)

      res.send(
        `Retrieved Access Token! <a href="/run/${access_token}">Click Here.</a>`,
      )

      setInterval(async () => {
        const data = await spotifyAPI.refreshAccessToken()
        const access_token = data.body['access_token']
        console.log('Refreshed Access Token: ', access_token)
        spotifyAPI.setAccessToken(access_token)
      }, (expires_in / 2) * 1000)
    })
    .catch((error) => {
      console.error('Token Error: ', error)
      res.send(`Token Error: ${error}`)
    })
})

const runProgram = async () => {
  for (const playlist of playlists) {
    const originalTracks = (
      await spotifyAPI.getPlaylistTracks(playlist.explicit, {
        fields: 'items',
      })
    ).body.items
    const finalTracks: string[] = []

    for (const originalTrack of originalTracks) {
      const track = originalTrack.track!
      const { name, artists } = track
      const artistName = artists[0].name

      if (!track.explicit) finalTracks.push(track.uri)
      else {
        const searchQuery = `track:"${name}" artist:${artistName}`
        const matchedTracks = (
          await spotifyAPI.searchTracks(searchQuery, { limit: 5 })
        ).body.tracks!.items
        const matchedTrack = matchedTracks.find(
          (matchedTrack) => !matchedTrack.explicit,
        )
        if (matchedTrack) {
          console.log(`Found Replacement For ${name} by ${artistName}`)
          finalTracks.push(matchedTrack.uri)
        } else {
          console.log(`No Replacement For    ${name} by ${artistName}`)
          finalTracks.push(track.uri)
        }
      }
    }

    await spotifyAPI.replaceTracksInPlaylist(playlist.clean, finalTracks)
  }
}

app.get('/run/:accessToken', async (req, res) => {
  const { accessToken } = req.params

  spotifyAPI.setAccessToken(accessToken)
  await runProgram().catch((err) => {
    console.error(err)
    res.end(`Error: ${err}`)
  })

  res.send('Success!')
})

app.listen(8888, () => console.log('Go To http://localhost:8888/login'))
