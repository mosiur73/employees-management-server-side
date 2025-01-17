const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.juc5u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("employee").collection("users");
    const employCollection = client.db("employee").collection("employ");
    const payrollCollection = client.db("employee").collection("payroll");

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })
    //middleware
    const verifyToken=(req,res,next)=>{
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
      
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    //user related api 
    app.post('/users', async (req, res) => {
        const user = req.body;
        //insert email if user doesnt exists 
        const query ={email:user.email}
        const exissingUser=await userCollection.findOne(query)
        if(exissingUser){
          return res.send({message:'user already exists',insertedId :null})
        }
       const result =await userCollection.insertOne(user)
        res.send(result);
      });

      app.get('/users',verifyToken, async(req,res) =>{
        const result=await userCollection.find().toArray()
        res.send(result)
      })

      //details page 
    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.findOne(query);
      res.send(result);
  }); 



      app.get('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }
        res.send({ admin });
      })
      
      app.patch('/users/admin/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
           
            verified:'verified'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })


      //current logged in employee data api
      app.post('/employee',async (req,res) =>{
        const user=req.body
        const result =await employCollection.insertOne(user)
        res.send(result)
      })

      app.get('/employee', async(req,res) =>{
       const result=await employCollection.find().toArray()
        res.send(result)
      })
     

      app.delete('/employee/:id', async (req,res) =>{
        const id=req.params.id;
        const query={_id: new ObjectId(id)}
        const result=await employCollection.deleteOne(query)
        res.send(result)
      })
      

      // Update employee data by ID
app.put('/employee/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true }; 
  const updatedData = req.body;

  // Update operation
  const updateDoc = {
      $set: {
          tasks: updatedData.tasks,
          hours: updatedData.hours,
          date: updatedData.date,
      },
  };

  try {
      const result = await employCollection.updateOne(filter, updateDoc, options);
      res.send(result);
  } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).send({ message: 'Error updating employee', error });
  }
});
 
//progress related  api
// app.get('/progress', async(req,res) =>{
//  const result=await employCollection.find().toArray()
//   res.send(result)
// })
app.get('/progress', async (req, res) => {
  const { name, month } = req.query; // Extract query parameters

  // Create a filter object
  const filter = {};

  if (name) {
    filter.name = name; // Filter by employee name
  }

  if (month) {
    const monthNumber = parseInt(month, 10);
    if (!isNaN(monthNumber)) {
      filter.date = {
        $regex: `-${month.padStart(2, '0')}-`, // Match month in the date string
      };
    }
  }

  try {
    const result = await employCollection.find(filter).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch progress data' });
  }
});



//payroll admin related
app.post('/payroll',async (req,res) =>{
  const user=req.body
  const result =await payrollCollection.insertOne(user)
  res.send(result)
})

app.get('/payroll',verifyToken, async(req,res) =>{
  const result=await payrollCollection.find().toArray()
  res.send(result)
})

app.get('/verified', async (req, res) => {
 const filter = { verified: "verified" };
    const result = await userCollection.find(filter).toArray();
    res.send(result);
  
});



    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('employee management is running ')
})

app.listen(port, () => {
    console.log(`employee management is running on port${port}`);
})