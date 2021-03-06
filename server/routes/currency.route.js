import express from 'express';
import currencyCtrl from '../controllers/currency.controller';

const router = express.Router(); // eslint-disable-line new-cap

router.route('/')

    /** POST /api/currency - Create new currency */
    .post(currencyCtrl.create)

    .get(currencyCtrl.search)

router.route('/upsert')

    /** POST /api/currency/upsert - Create or update new currency */
    .post(currencyCtrl.updateOrCreate);

router.route('/:currencyId')

    /** GET /api/currency/:currencyId - Get currency */
    .get(currencyCtrl.get)
    /** PUT /api/currency/:currencyId - Update currency */
    .put(currencyCtrl.update)

/** Load currency when API with currencyId route parameter is hit */
router.param('currencyId', currencyCtrl.load);

export default router;
