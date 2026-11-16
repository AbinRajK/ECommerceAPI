const router = require('express').Router();
const controller = require('../controllers/category.controller');
const validate = require('../middleware/validate');
const validators = require('../validators/category.validator');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Public: full (active) category hierarchy
router.get('/tree', controller.tree);

// Admin only
router.use(authenticate, authorize(ROLES.ADMIN));
router.post('/', validate(validators.create), controller.create);
router.get('/', validate(validators.list), controller.list);
router.get('/:id', validate(validators.byId), controller.getById);
router.patch('/:id', validate(validators.update), controller.update);
router.delete('/:id', validate(validators.byId), controller.remove);

module.exports = router;
