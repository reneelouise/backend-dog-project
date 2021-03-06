import { Client } from "pg";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
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


app.use(express.json()); //add body parser to each following route handler
app.use(cors()); //add CORS support to each following route handler

const client = new Client(dbConfig);
client.connect();

app.get("/leaderboard", async (req, res) => {
  try {
    const dbres = await client.query('select * from breeds order by votes desc limit 10');
    res.json(dbres.rows);
  } catch (error) {
    console.error(error.message);

  }
});

app.get("/random", async (req, res) => {
  try {
    const dbres = await client.query('SELECT * FROM breeds ORDER BY random() LIMIT 2;');
    res.json(dbres.rows);

  } catch (error) {
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

type ListOfBreedsResponse = {
  data: {
    message: { [key: string]: string[] },
    status: string
  }
}

const writeBreed = async (breedName: string) => {
  const normalizedBreedName = breedName.replace("/", "-")
  const images = await axios.get(`https://dog.ceo/api/breed/${breedName}/images`)
  console.log(images.data.message)
  await client.query("INSERT INTO breeds (breed, image) VALUES($1, $2) RETURNING *", [normalizedBreedName, images.data.message])

}

async function populateDatabase() {
  const count = await client.query("SELECT COUNT(*) FROM breeds");
  if (!count.rows[0].count) {
    const listOfAllBreeds: ListOfBreedsResponse = await axios.get(`https://dog.ceo/api/breeds/list/all`)
    const promiseArr: Promise<unknown>[] = []
    Object.entries(listOfAllBreeds.data.message).forEach(([breed, subbreeds]) => {
      if (subbreeds.length) {
        subbreeds.forEach((subbreed) => {
          promiseArr.push(writeBreed(`${breed}/${subbreed}`))
        })
      }
      else {
        promiseArr.push(writeBreed(breed))
      }
    })
    await Promise.all(promiseArr)
  }
}

//Start the server on the given port
const port = process.env.PORT;
if (!port) {
  throw 'Missing PORT environment variable.  Set it in .env file.';
}
app.listen(port, async () => {
  await populateDatabase()
  console.log(`Server is up and running on port ${port}`);
});
