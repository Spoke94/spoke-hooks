import express from "express";

const app = express();
const port = 3000;

app.use(express.json());

app.post("/webhook", (request, response) => {
  console.log("Webhook received:");
  console.log(request.body);

  response.status(200).json({
    received: true
  });
});

app.listen(port, () => {
  console.log(`Example webhook server listening on http://localhost:${port}`);
});

