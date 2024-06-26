var express = require('express');
var router = express.Router();

// Require controller modules.
var config_controller = require('../controllers/configController');

// Routes
router.get('/', config_controller.config_home);

module.exports = router;