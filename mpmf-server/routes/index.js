var express = require('express');
var router = express.Router();

// Require controller modules.
var home_controller = require('../controllers/indexController');

// Routes
router.get('/', home_controller.home);

module.exports = router;


