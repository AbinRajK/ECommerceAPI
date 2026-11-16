const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const validators = require('../validators/auth.validator');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, validate(validators.register), controller.register);
router.post('/login', authLimiter, validate(validators.login), controller.login);

module.exports = router;
