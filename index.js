const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 4000;

//middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// jwt middleware

const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers.authorization;
  if (!bearerHeader) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }
  const token = bearerHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fmrdqpo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const menu = client.db("grocery-bazaar-data").collection("menu");
    const productsCollection = client
      .db("grocery-bazaar-data")
      .collection("products");
    const reviews = client.db("grocery-bazaar-data").collection("reviews");
    const cartCollection = client.db("grocery-bazaar-data").collection("carts");
    const userCollection = client.db("grocery-bazaar-data").collection("users");
    const orderCollection = client
      .db("grocery-bazaar-data")
      .collection("orders");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });
      res.send(token);
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };

    // user api

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.json(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false, message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // if (req.decoded.email !== email) {
      //   return res
      //     .status(403)
      //     .send({ error: true, message: "Forbidden Access" });
      // }
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.json(result);
    });
    // GET USERS
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //delete users
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.json(result);
    });

    // post products
    app.post("/products", verifyToken, verifyAdmin, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.json(result);
    });
    // post order
    app.post("/orders", verifyToken, async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.json(result);
    });

    // get orders
    app.get("/orders", async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    // get orders by id
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    // get products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    //delete products
    app.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.json(result);
    });

    // menu api
    app.get("/menu", async (req, res) => {
      const result = await menu.find().toArray();
      res.send(result);
    });
    // review apis
    app.get("/reviews", async (req, res) => {
      const result = await reviews.find().toArray();
      res.send(result);
    });
    // cart collection
    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await cartCollection.insertOne(cart);
      res.json(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("  Server is up and running");
});
app.get("/home", (req, res) => {
  res.send("  Server running on home");
});

app.listen(port, () => {
  console.log(`Server started on  http://localhost:${port} `);
});
