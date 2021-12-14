import { Client } from "pg";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
import { breeds } from './breeds'
import axios from 'axios';

config(); //Read .env file lines as though they were env vars.

//Call this script with the environment variable LOCAL set if you want to connect to a local db (i.e. without SSL)
//Do not set the environment variable LOCAL if you want to connect to a heroku DB.

//For the ssl property of the DB connection config, use a value of...
// false - when connecting to a local DB
// { rejectUnauthorized: false } - when connecting to a heroku DB
const herokuSSLSetting = { rejectUnauthorized: false }
const sslSetting = process.env.LOCAL ? false : herokuSSLSetting
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: sslSetting,
};

const app = express();

interface Dogs {
  breed: string
  subbreed: boolean
  votes: number
}

async function images(breed: string) {
  const images = await axios.get(`https://dog.ceo/api/breed/${breed}/images`)
  return { breed, images };
}

const filteredBreeds = breeds.filter(breed => !breed.includes('-'));

async function toImages() {
  return await Promise.all(filteredBreeds.map(images));
}

console.log(toImages())

app.use(express.json()); //add body parser to each following route handler
app.use(cors()); //add CORS support to each following route handler

const client = new Client(dbConfig);
client.connect();

app.get("/", async (req, res) => {
  try {
    const dbres = await client.query('select * from breeds');
    res.json(dbres.rows);

  } catch (error) {
    console.error(error.message);

  }
});



app.post<{}, {}, Dogs>("/", async (req, res) => {
  try {
    const { breed, subbreed, votes } = req.body;
    const newDog = await client.query("INSERT INTO breeds (breed, subbreed, votes) VALUES($1, $2, $3) RETURNING *", [breed, subbreed, votes]);
    res.json(newDog.rows[0]);
  }
  catch (error) {
    console.error(error.message);
  }
});

app.put<{ id: number }, {}, Dogs>("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const newDog = await client.query("UPDATE breeds SET votes = votes + 1 WHERE id=$1 RETURNING * ", [id]);
    res.json(newDog.rows[0]);
  }
  catch (error) {
    console.error(error.message);
  }
});


//Start the server on the given port
const port = process.env.PORT;
if (!port) {
  throw 'Missing PORT environment variable.  Set it in .env file.';
}
app.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});
