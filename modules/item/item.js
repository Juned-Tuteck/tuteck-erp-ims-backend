const db = require('../../config/database');
const xlsx = require('xlsx');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const itemController = {
  // Get all items
  async getAll(req, res) {
    try {
      const result = await db.query(
        `SELECT 
          i.*, 
          b.brand_name, 
          c.category_name, 
          u.uom_name
        FROM ims.t_item i
        LEFT JOIN ims.t_brand b ON i.brand_id = b.id
        LEFT JOIN ims.t_category c ON i.category_id = c.id
        LEFT JOIN ims.t_uom u ON i.uom_id = u.id
        WHERE i.is_active = true AND i.is_deleted = false
        ORDER BY i.created_at DESC`
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

      let currentTimestamp = new Date();
      const created_at = currentTimestamp.toISOString().replace('T', ' ').replace('Z', ' +0000');
      
      const result = await db.query(
        `INSERT INTO ims.t_item (
          item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
          latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
          latest_lowest_net_rate, dimensions, parent_item_id, material_type,
          category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
          is_capital_item, is_scrap_item, insurance_number, insurance_provider,
          insurance_type, insurance_renewal_frequency, insurance_start_date,
          insurance_end_date, insurance_premium_amount, insurance_claim_amount,
          insurance_status, created_by, created_at, vendor_supply_rate_updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $31
        ) RETURNING *`,
        [
          item_code, item_name, hsn_code, description, safety_stock, reorder_quantity,
          latest_lowest_basic_supply_rate, latest_lowest_basic_installation_rate,
          latest_lowest_net_rate, dimensions, parent_item_id, material_type,
          category_id, brand_id, uom_id, installation_rate, unit_price, uom_value,
          is_capital_item, is_scrap_item, insurance_number, insurance_provider,
          insurance_type, insurance_renewal_frequency, insurance_start_date,
          insurance_end_date, insurance_premium_amount, insurance_claim_amount,
          insurance_status, CREATED_BY, created_at
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
  },

  // // Process uploaded Excel and bulk insert items
  // async processExcelAndBulkInsert(req, res) {
  //   const client = await db.getClient();
  //   try {
  //     // Check if a file is uploaded
  //     if (!req.file) {
  //       return res.status(400).json({
  //         success: false,
  //         statusCode: 400,
  //         data: null,
  //         clientMessage: 'No file uploaded',
  //         devMessage: 'Excel file is required for processing'
  //       });
  //     }

  //     // Read the uploaded Excel file
  //     const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  //     const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
  //     const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

  //     if (sheetData.length <= 1) {
  //       return res.status(400).json({
  //         success: false,
  //         statusCode: 400,
  //         data: null,
  //         clientMessage: 'Excel file is empty or has no data rows',
  //         devMessage: 'No data found in the uploaded Excel file'
  //       });
  //     }

  //     const headers = sheetData[0].map(header => header.trim().toLowerCase());
  //     console.log('Headers:', headers); // Debugging line to check headers
  //     const rows = sheetData.slice(1);

  //     const fieldMappings = {
  //       'item name': 'item_name',
  //       'hsn code': 'hsn_code',
  //       'description': 'description',
  //       'safety stock': 'safety_stock',
  //       'reorder quantity': 'reorder_quantity',
  //       'base vendor supply rate': 'latest_lowest_basic_supply_rate',
  //       'base installation rate': 'latest_lowest_basic_installation_rate',
  //       'latest lowest net rate': 'latest_lowest_net_rate',
  //       'dimensions': 'dimensions',
  //       'parent item id': 'parent_item_id',
  //       'material type': 'material_type',
  //       'category id': 'category_id',
  //       'brand id': 'brand_id',
  //       'uom id': 'uom_id',
  //       'installation rate': 'installation_rate',
  //       'is capital item': 'is_capital_item',
  //       'is scrap item': 'is_scrap_item',
  //       'insurance number': 'insurance_number',
  //       'insurance provider': 'insurance_provider',
  //       'insurance type': 'insurance_type',
  //       'insurance renewal frequency': 'insurance_renewal_frequency',
  //       'insurance start date': 'insurance_start_date',
  //       'insurance end date': 'insurance_end_date',
  //       'insurance premium amount': 'insurance_premium_amount',
  //       'insurance claim amount': 'insurance_claim_amount',
  //       'insurance status': 'insurance_status'
  //     };

  //     const columnIndexes = {};
  //     for (const [humanReadable, dbField] of Object.entries(fieldMappings)) {
  //       const index = headers.indexOf(humanReadable);
  //       if (index !== -1) {
  //         columnIndexes[dbField] = index;
  //       }
  //     }

  //     await client.query('BEGIN');
  //     const insertedItems = [];

  //     let currentTimestamp = new Date(); // Start with the current timestamp

  //     console.log("rows: ", rows)
      
  //     for (const row of rows) {
  //       if (row.length>0){
  //         const itemData = {};
  //         for (const [dbField, index] of Object.entries(columnIndexes)) {
  //           itemData[dbField] = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : null;
  //         }

  //         if (!itemData.item_name) {
  //           throw new Error('Item Name is required in each row');
  //         }

  //         console.log('Item Data:', itemData); // Debugging line to check item data

  //         const created_at = currentTimestamp.toISOString().replace('T', ' ').replace('Z', ' +0000');
  //         currentTimestamp = new Date(currentTimestamp.getTime() + 10); // Increment by 1 millisecond

  //         const result = await client.query(
  //           `INSERT INTO ims.t_item (
  //             ${Object.keys(itemData).join(', ')}, created_by, created_at, vendor_supply_rate_updated_at
  //           ) VALUES (
  //             ${Object.keys(itemData).map((_, i) => `$${i + 1}`).join(', ')}, $${Object.keys(itemData).length + 1}, $${Object.keys(itemData).length + 2}, $${Object.keys(itemData).length + 2}
  //           ) RETURNING *`,
  //           [...Object.values(itemData), CREATED_BY, created_at]
  //         );
  //         insertedItems.push(result.rows[0]);
  //       }
  //     }

  //     await client.query('COMMIT');

  //     return res.status(201).json({
  //       success: true,
  //       statusCode: 201,
  //       data: insertedItems,
  //       clientMessage: 'Excel data processed and inserted successfully',
  //       devMessage: `${insertedItems.length} items inserted successfully`
  //     });
  //   } catch (error) {
  //     await client.query('ROLLBACK');
  //     return res.status(500).json({
  //       success: false,
  //       statusCode: 500,
  //       data: null,
  //       clientMessage: 'Something went wrong, please try again later',
  //       devMessage: error.message
  //     });
  //   } finally {
  //     client.release();
  //   }
  // },

  // Process uploaded Excel and bulk insert items
  async processExcelAndBulkInsert(req, res) {
    const client = await db.getClient();
    try {
      // Check if a file is uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'No file uploaded',
          devMessage: 'Excel file is required for processing'
        });
      }

      // Read the uploaded Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      if (sheetData.length <= 1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'Excel file is empty or has no data rows',
          devMessage: 'No data found in the uploaded Excel file'
        });
      }

      const headers = sheetData[0].map(header => header.trim().toLowerCase());
      const rows = sheetData.slice(1);

      const fieldMappings = {
        'item name': 'item_name',
        'hsn code': 'hsn_code',
        'description': 'description',
        'safety stock': 'safety_stock',
        'reorder quantity': 'reorder_quantity',
        'base vendor supply rate': 'latest_lowest_basic_supply_rate',
        'base installation rate': 'latest_lowest_basic_installation_rate',
        'latest lowest net rate': 'latest_lowest_net_rate',
        'dimensions': 'dimensions',
        'parent item id': 'parent_item_id',
        'material type': 'material_type',

        // 🔹 Use *codes* instead of IDs
        'category code': 'category_code',
        'brand code': 'brand_code',
        'uom code': 'uom_code',

        'installation rate': 'installation_rate',
        'is capital item': 'is_capital_item',
        'is scrap item': 'is_scrap_item',
        'insurance number': 'insurance_number',
        'insurance provider': 'insurance_provider',
        'insurance type': 'insurance_type',
        'insurance renewal frequency': 'insurance_renewal_frequency',
        'insurance start date': 'insurance_start_date',
        'insurance end date': 'insurance_end_date',
        'insurance premium amount': 'insurance_premium_amount',
        'insurance claim amount': 'insurance_claim_amount',
        'insurance status': 'insurance_status'
      };

      const columnIndexes = {};
      for (const [humanReadable, dbField] of Object.entries(fieldMappings)) {
        const index = headers.indexOf(humanReadable);
        if (index !== -1) {
          columnIndexes[dbField] = index;
        }
      }

      await client.query('BEGIN');
      const insertedItems = [];
      let currentTimestamp = new Date();

      for (const row of rows) {
        if (row.length > 0) {
          const itemData = {};
          for (const [dbField, index] of Object.entries(columnIndexes)) {
            itemData[dbField] = row[index] !== undefined && row[index] !== null
              ? String(row[index]).trim()
              : null;
          }

          if (!itemData.item_name) {
            throw new Error('Item Name is required in each row');
          }

           // 🔹 Convert string booleans → real booleans (default false)
          const boolFields = ['is_capital_item', 'is_scrap_item'];
          for (const field of boolFields) {
            if (itemData[field] === null || itemData[field] === '') {
              itemData[field] = false;
            } else {
              const value = itemData[field].toString().toLowerCase();
              if (['true', 'yes', '1'].includes(value)) itemData[field] = true;
              else itemData[field] = false; // everything else → false
            }
          }

          // 🔹 Lookup actual IDs from code fields
          let categoryId = null;
          let brandId = null;
          let uomId = null;

          if (itemData.category_code) {
            const result = await client.query(
              'SELECT id FROM ims.t_category WHERE category_code = $1',
              [itemData.category_code]
            );
            categoryId = result.rows[0]?.id || null;

            const brandResult = await client.query(
              'SELECT brand_id FROM ims.t_category WHERE category_code = $1',
              [itemData.category_code]
            );
            brandId = brandResult.rows[0]?.brand_id || null;
          }

          if (itemData.uom_code) {
            const result = await client.query(
              'SELECT id FROM ims.t_uom WHERE uom_code = $1',
              [itemData.uom_code]
            );
            uomId = result.rows[0]?.id || null;
          }

          // 🔹 Replace codes with actual IDs for insertion
          itemData.category_id = categoryId;
          itemData.brand_id = brandId;
          itemData.uom_id = uomId;

          delete itemData.category_code;
          delete itemData.brand_code;
          delete itemData.uom_code;

          const created_at = currentTimestamp.toISOString().replace('T', ' ').replace('Z', ' +0000');
          currentTimestamp = new Date(currentTimestamp.getTime() + 10);

          const result = await client.query(
            `INSERT INTO ims.t_item (
              ${Object.keys(itemData).join(', ')}, created_by, created_at, vendor_supply_rate_updated_at
            ) VALUES (
              ${Object.keys(itemData).map((_, i) => `$${i + 1}`).join(', ')},
              $${Object.keys(itemData).length + 1}, $${Object.keys(itemData).length + 2}, $${Object.keys(itemData).length + 2}
            ) RETURNING *`,
            [...Object.values(itemData), CREATED_BY, created_at]
          );

          insertedItems.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedItems,
        clientMessage: 'Excel data processed and inserted successfully',
        devMessage: `${insertedItems.length} items inserted successfully`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    } finally {
      client.release();
    }
  },

  // Export all items to Excel
  async exportToExcel(req, res) {
    try {
      // Fetch all item data
      const result = await db.query(
        `SELECT 
          id AS item_id, 
          item_code, 
          item_name, 
          hsn_code, 
          description, 
          safety_stock, 
          reorder_quantity, 
          latest_lowest_basic_supply_rate, 
          latest_lowest_basic_installation_rate, 
          latest_lowest_net_rate, 
          dimensions, 
          parent_item_id, 
          material_type, 
          category_id, 
          brand_id, 
          uom_id, 
          installation_rate, 
          is_capital_item, 
          is_scrap_item, 
          insurance_number, 
          insurance_provider, 
          insurance_type, 
          insurance_renewal_frequency, 
          insurance_start_date, 
          insurance_end_date, 
          insurance_premium_amount, 
          insurance_claim_amount, 
          insurance_status, 
          is_active, 
          is_deleted
        FROM ims.t_item 
        ORDER BY created_at DESC`
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'No item data found',
          devMessage: 'No data available in the item table'
        });
      }

      // Prepare Excel data
      const headers = [
        'Item ID',
        'Item Code',
        'Item Name',
        'HSN Code',
        'Description',
        'Safety Stock',
        'Reorder Quantity',
        'Latest Lowest Basic Supply Rate',
        'Latest Lowest Basic Installation Rate',
        'Latest Lowest Net Rate',
        'Dimensions',
        'Parent Item ID',
        'Material Type',
        'Category ID',
        'Brand ID',
        'UOM ID',
        'Installation Rate',
        'Is Capital Item',
        'Is Scrap Item',
        'Insurance Number',
        'Insurance Provider',
        'Insurance Type',
        'Insurance Renewal Frequency',
        'Insurance Start Date',
        'Insurance End Date',
        'Insurance Premium Amount',
        'Insurance Claim Amount',
        'Insurance Status',
        'Is Active',
        'Is Deleted'
      ];

      const rows = result.rows.map(row => [
        row.item_id,
        row.item_code,
        row.item_name,
        row.hsn_code,
        row.description,
        row.safety_stock,
        row.reorder_quantity,
        row.latest_lowest_basic_supply_rate,
        row.latest_lowest_basic_installation_rate,
        row.latest_lowest_net_rate,
        row.dimensions,
        row.parent_item_id,
        row.material_type,
        row.category_id,
        row.brand_id,
        row.uom_id,
        row.installation_rate,
        row.is_capital_item ? 'Yes' : 'No',
        row.is_scrap_item ? 'Yes' : 'No',
        row.insurance_number,
        row.insurance_provider,
        row.insurance_type,
        row.insurance_renewal_frequency,
        row.insurance_start_date,
        row.insurance_end_date,
        row.insurance_premium_amount,
        row.insurance_claim_amount,
        row.insurance_status,
        row.is_active ? 'Yes' : 'No',
        row.is_deleted ? 'Yes' : 'No'
      ]);

      // Create a new workbook and worksheet
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

      // Append the worksheet to the workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Items');

      // Write the workbook to a buffer
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for file download
      res.setHeader('Content-Disposition', 'attachment; filename="items.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // Send the Excel file as a response
      return res.status(200).send(excelBuffer);
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  }
};

module.exports = itemController;