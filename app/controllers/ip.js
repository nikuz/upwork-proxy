function pSave(req, res) {
  var body = req.body || {};
  console.log(body);
}

exports = module.exports = {
  save: pSave
};
