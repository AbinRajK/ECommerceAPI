const router = require('express').Router();
const controller = require('../controllers/product.controller');
const validate = require('../middleware/validate');
const validators = require('../validators/product.validator');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Public customer catalogue (active products only)
router.get('/', validate(validators.customerList), controller.list);

// Admin (declared before "/:id" so "admin" is not treated as an id)
const admin = [authenticate, authorize(ROLES.ADMIN)];
router.get('/admin/list', ...admin, validate(validators.adminList), controller.adminList);
router.get('/admin/:id', ...admin, validate(validators.byId), controller.adminGetById);
router.post('/', ...admin, validate(validators.create), controller.create);
router.patch('/:id', ...admin, validate(validators.update), controller.update);
router.delete('/:id', ...admin, validate(validators.byId), controller.remove);

router.get('/:id', validate(validators.byId), controller.getById);

module.exports = router;
