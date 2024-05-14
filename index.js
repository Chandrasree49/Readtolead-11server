const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const port = process.env.PORT || 3000;

const app = express();

const corsOptions = {
  origin: "*",
  Credential: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const uri =
  "mongodb+srv://Readtolead:NIYbjyw9YNBI2nfk@cluster0.cwtzcv2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const Book = mongoose.model("Book", {
//   image: String,
//   name: String,
//   quantity: Number,
//   author: String,
//   category: String,
//   description: String,
//   rating: Number,
// });

const JWT_SECRET = process.env.jwt;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(process.env.jwt);
});

app.listen(port, () => console.log(`Server running on port ${port}`));
