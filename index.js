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
      const token = jwt.sign(
        { email },
        "u3TtYfwq8cD4gEn9rGmQhWjYmZq4t7w9z$C&F)J@NcRfUjXn2r5u8x/A?D(G+Kb",
        { expiresIn: 86400 }
      ); // Expires in 24 hours
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

    app.put("/updatebook/:bookId", async (req, res) => {
      try {
        const bookId = req.params.bookId;

        // Extract updated book data from the request body
        const { image, name, authorName, category, rating } = req.body;

        // Update the book information in the database
        const result = await bookCollection.updateOne(
          { _id: new ObjectId(bookId) },
          { $set: { image, name, authorName, category, rating } }
        );

        if (result.modifiedCount === 0) {
          // No book was updated (book with the provided ID not found)
          return res.status(404).json({ message: "Book not found" });
        }

        res.status(200).json({ message: "Book updated successfully" });
      } catch (error) {
        console.error("Error updating book:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/booksbycat/:category", async (req, res) => {
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

    app.post("/api/checkborrowed/:id", async (req, res) => {
      try {
        const { userEmail } = req.body;
        const bookId = req.params.id;

        // Check if the book with the given bookId exists in the bookCollection
        const book = await borrowedBooksCollection.findOne({
          bookid: new ObjectId(bookId),
          userEmail: userEmail,
        });
        if (book) {
          return res.status(200).json({ message: "yes" });
        } else {
          return res.status(200).json({ message: "no" });
        }

        // Check if the book with the given bookId is borrowed by the user with the given userEmail
      } catch (error) {
        console.error("Error checking borrowed book:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/borrow/:id", async (req, res) => {
      try {
        const bookId = req.params.id;
        const { userEmail, userName, returnDate, borroweddate } = req.body;

        // Ensure userEmail and userName are provided in the request body
        if (!userEmail || !userName) {
          return res
            .status(400)
            .json({ message: "User email and display name are required" });
        }

        const bookData = await bookCollection.findOne({
          _id: new ObjectId(bookId),
        });

        if (bookData.quantity <= 0) {
          return res
            .status(404)
            .json({ message: "Book not available for borrowing" });
        }

        // Find the book by ID and decrement its quantity by 1 using the $inc operator
        const book = await bookCollection.findOneAndUpdate(
          { _id: new ObjectId(bookId), quantity: { $gt: 0 } }, // Ensure quantity is greater than 0
          { $inc: { quantity: -1 } }, // Decrement quantity by 1
          { returnOriginal: false } // Return the updated document
        );

        console.log(book);

        // Add the borrowed book to the borrowedBooksCollection
        // Include all data of the borrowed book
        await borrowedBooksCollection.insertOne({
          bookid: book._id,
          image: book.image,
          name: book.name,
          quantity: book.quantity,
          authorName: book.authorName,
          category: book.category,
          shortDescription: book.shortDescription,
          rating: book.rating,
          borrower: book.borrower,
          borrowedBy: book.borrowedBy,
          addedBy: book.addedBy,
          userEmail,
          userName,
          returnDate, // Include return date from request body
          borroweddate,
        });

        res.status(200).json({ message: "Book borrowed successfully" });
      } catch (error) {
        console.error("Error borrowing book:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/borrowedbooks/:userEmail", async (req, res) => {
      try {
        const userEmail = req.params.userEmail;

        // Find all borrowed books for the user with the provided email
        const borrowedBooks = await borrowedBooksCollection
          .find({ userEmail })
          .toArray();

        console.log(borrowedBooks);

        // Retrieve detailed book information for each borrowed book
        const detailedBorrowedBooks = await Promise.all(
          borrowedBooks.map(async (borrowedBook) => {
            // Find the detailed book information using the book ID
            const book = await bookCollection.findOne({
              _id: borrowedBook.bookid,
            });
            console.log(book);

            return {
              id: book._id,
              image: book.image,
              name: book.name,
              category: book.category,
              borrowedDate: borrowedBook.borrowedDate,
              returnDate: borrowedBook.returnDate,
            };
          })
        );

        res.status(200).json(detailedBorrowedBooks);
      } catch (error) {
        console.error("Error fetching borrowed books:", error);
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
