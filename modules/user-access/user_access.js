const express = require("express");
const axios = require("axios");
const router = express.Router();
require("dotenv").config();

router.post("/validate-with-access-ims", async (req, res) => {
  try {
    console.log("hit from ims user access");
    const response = await axios.post(
      `${process.env.VITE_AUTH_BASE_URL}/auth/validate-with-access`,
      req.body,
      {
        headers: {
          Authorization: req.headers.authorization || req.headers.Authorization,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res
        .status(500)
        .json({ error: "Internal server error", details: error.message });
    }
  }
});

module.exports = router;
