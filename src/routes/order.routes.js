const router = require('express').Router();
const controller = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const validators = require('../validators/order.validator');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorize(ROLES.CUSTOMER), validate(validators.create), controller.create);
// Customers see only their own orders; admins see all (scoping is enforced in the service).
router.get('/', validate(validators.list), controller.list);
router.get('/:id', validate(validators.byId), controller.getById);
router.patch('/:id/cancel', authorize(ROLES.CUSTOMER), validate(validators.byId), controller.cancel);
router.patch('/:id/status', authorize(ROLES.ADMIN), validate(validators.updateStatus), controller.updateStatus);

module.exports = router;
