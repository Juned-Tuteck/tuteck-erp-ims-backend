const db = require('../../config/database');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const itemController = {
  // Get all items
  async getAll(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM ims.t_item WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC'
      );
      
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'Items retrieved successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Get item by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_item WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Item not found',
          devMessage: 'No item found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'Item retrieved successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Create item
  async create(req, res) {
    try {
      const {
        item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
        latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
        latest_lowest_net_rate, dimensions, parent_item_id, material_type,
        category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
        is_capital_item, is_scrap_item, insurance_number, insurance_provider,
        insurance_type, insurance_renewal_frequency, insurance_start_date,
        insurance_end_date, insurance_premium_amount, insurance_claim_amount,
        insurance_status
      } = req.body;
      
      const result = await db.query(
        `INSERT INTO ims.t_item (
          item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
          latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
          latest_lowest_net_rate, dimensions, parent_item_id, material_type,
          category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
          is_capital_item, is_scrap_item, insurance_number, insurance_provider,
          insurance_type, insurance_renewal_frequency, insurance_start_date,
          insurance_end_date, insurance_premium_amount, insurance_claim_amount,
          insurance_status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
        ) RETURNING *`,
        [
          item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
          latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
          latest_lowest_net_rate, dimensions, parent_item_id, material_type,
          category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
          is_capital_item, is_scrap_item, insurance_number, insurance_provider,
          insurance_type, insurance_renewal_frequency, insurance_start_date,
          insurance_end_date, insurance_premium_amount, insurance_claim_amount,
          insurance_status, CREATED_BY
        ]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'Item created successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Update item (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;
      
      const validFields = {};
      Object.keys(updateFields).forEach(key => {
        if (updateFields[key] !== null && updateFields[key] !== undefined) {
          validFields[key] = updateFields[key];
        }
      });

      if (Object.keys(validFields).length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'No valid fields to update',
          devMessage: 'Request body contains no valid update fields'
        });
      }

      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;

      const setClause = Object.keys(validFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(validFields)];

      const result = await db.query(
        `UPDATE ims.t_item SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Item not found',
          devMessage: 'No item found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'Item updated successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Delete item (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_item SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Item not found',
          devMessage: 'No item found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'Item deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Bulk insert items
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const items = req.body;
      const insertedItems = [];

      for (const item of items) {
        const {
          item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
          latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
          latest_lowest_net_rate, dimensions, parent_item_id, material_type,
          category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
          is_capital_item, is_scrap_item, insurance_number, insurance_provider,
          insurance_type, insurance_renewal_frequency, insurance_start_date,
          insurance_end_date, insurance_premium_amount, insurance_claim_amount,
          insurance_status
        } = item;
        
        const result = await client.query(
          `INSERT INTO ims.t_item (
            item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
            latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
            latest_lowest_net_rate, dimensions, parent_item_id, material_type,
            category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
            is_capital_item, is_scrap_item, insurance_number, insurance_provider,
            insurance_type, insurance_renewal_frequency, insurance_start_date,
            insurance_end_date, insurance_premium_amount, insurance_claim_amount,
            insurance_status, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
          ) RETURNING *`,
          [
            item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
            latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
            latest_lowest_net_rate, dimensions, parent_item_id, material_type,
            category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
            is_capital_item, is_scrap_item, insurance_number, insurance_provider,
            insurance_type, insurance_renewal_frequency, insurance_start_date,
            insurance_end_date, insurance_premium_amount, insurance_claim_amount,
            insurance_status, CREATED_BY
          ]
        );
        insertedItems.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedItems,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedItems.length} items inserted successfully`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = itemController;