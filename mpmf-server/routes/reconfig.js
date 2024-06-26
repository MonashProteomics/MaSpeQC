var express = require('express');
var router = express.Router();

// Require controller modules.
var reconfig_controller = require('../controllers/reconfigController');

// Routes
router.get('/', reconfig_controller.reconfig_home);

module.exports = router;