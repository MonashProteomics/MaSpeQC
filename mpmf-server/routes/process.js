var express = require('express');
var router = express.Router();

// Require controller modules.
var process_controller = require('../controllers/processController');

// Routes
router.get('/', process_controller.process_home);

module.exports = router;