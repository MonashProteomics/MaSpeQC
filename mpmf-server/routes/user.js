var express = require('express');
var router = express.Router();

// Require controller modules.
var user_controller = require('../controllers/userGuideController');

// Routes
router.get('/', user_controller.user_home);

module.exports = router;