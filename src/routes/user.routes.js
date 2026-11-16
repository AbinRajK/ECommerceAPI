const router = require('express').Router();
const controller = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const validators = require('../validators/user.validator');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authenticate);

// Own profile (any authenticated user)
router.get('/me', controller.getProfile);
router.patch('/me', validate(validators.updateProfile), controller.updateProfile);
router.patch('/me/password', validate(validators.changePassword), controller.changePassword);

// Admin only
router.use(authorize(ROLES.ADMIN));
router.get('/', validate(validators.listUsers), controller.list);
router.get('/:id', validate(validators.getUser), controller.getById);
router.patch('/:id/status', validate(validators.setStatus), controller.setStatus);

module.exports = router;
