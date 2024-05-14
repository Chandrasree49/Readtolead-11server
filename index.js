const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.mongocl;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(uri);
const database = client.db("booksdb");
const bookCollection = database.collection("books");
const borrowedBooksCollection = database.collection("borrowedbook");

const JWT_SECRET = process.env.JWT_SECRET;

app.get("/", (req, res) => {
  res.send("Server is running");
});

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    app.post("/api/jwt", (req, res) => {
      const { email } = req.body;
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: 86400 }); // Expires in 24 hours
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      res.status(200).send({ auth: true, token: token });
    });

    app.post("/api/logout", (req, res) => {
      res.clearCookie("token").send({ success: true });
    });

    app.post("/api/addbook", async (req, res) => {
      try {
        const {
          image,
          name,
          quantity,
          authorName,
          category,
          shortDescription,
          rating,
          isBorrowed,
          borrower,
          borrowedBy,
          addedBy,
        } = req.body;

        const newBook = {
          image,
          name,
          quantity,
          authorName,
          category,
          shortDescription,
          rating,
          isBorrowed,
          borrower,
          borrowedBy,
          addedBy,
        };

        // Assuming 'bookCollection' is your MongoDB collection for books
        const result = await bookCollection.insertOne(newBook);

        res.status(201).json({ message: "Book added successfully", data: "" });
      } catch (error) {
        console.error("Error adding book:", error);
        res.status(500).json({ message: error });
      }
    });

    app.get("/api/books/:category", async (req, res) => {
      try {
        const category = req.params.category;

        // Query the bookCollection directly
        const books = await bookCollection.find({ category }).toArray();

        res.status(200).json(books);
      } catch (error) {
        console.error("Error fetching books:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/getbookbyid/:id", async (req, res) => {
      try {
        const bookId = req.params.id;

        // Query the bookCollection directly by book ID

        const book = await bookCollection.findOne({
          _id: new ObjectId(bookId),
        });

        if (!book) {
          return res.status(404).json({ message: "Book not found" });
        }

        res.status(200).json(book);
      } catch (error) {
        console.error("Error fetching book:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/borrow/:id", async (req, res) => {
      try {
        const bookId = req.params.id;
        const { userEmail, userName, returnDate } = req.body;

        // Ensure userEmail and userName are provided in the request body
        if (!userEmail || !userName) {
          return res
            .status(400)
            .json({ message: "User email and display name are required" });
        }

        // Find the book by ID and decrement its quantity by 1 using the $inc operator
        const book = await bookCollection.findOneAndUpdate(
          { _id: new ObjectId(bookId), quantity: { $gt: 0 } }, // Ensure quantity is greater than 0
          { $inc: { quantity: -1 } }, // Decrement quantity by 1
          { returnOriginal: false } // Return the updated document
        );

        if (!book.value) {
          // Book not found or quantity is already 0
          return res
            .status(404)
            .json({ message: "Book not available for borrowing" });
        }

        // Add the borrowed book to the borrowedBooksCollection
        // Include all data of the borrowed book
        await borrowedBooksCollection.insertOne({
          book: book.value, // Include all data of the borrowed book
          userEmail,
          userName,
          returnDate, // Include return date from request body
        });

        res.status(200).json({ message: "Book borrowed successfully" });
      } catch (error) {
        console.error("Error borrowing book:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.listen(port, () => {
      console.log(`Server is running on port: ${port}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}
startServer();
