var express = require('express');
var router = express.Router();

// Require controller modules.
var custom_controller = require('../controllers/customController');

// Routes
router.get('/', custom_controller.custom_home);

module.exports = router;