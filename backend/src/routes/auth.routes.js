const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

router.post('/login',        ctrl.login);
router.post('/select-role',  ctrl.selectRole);
router.get('/me',            authenticate, ctrl.me);
router.put('/change-password', authenticate, ctrl.changePassword);

module.exports = router;
