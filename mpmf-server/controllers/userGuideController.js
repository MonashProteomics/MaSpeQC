// Get user guide page
exports.user_home = function(req, res) {
    var caller = req.query.caller;
    res.render('user', {'type': caller});

}