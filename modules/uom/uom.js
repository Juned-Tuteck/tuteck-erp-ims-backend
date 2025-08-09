const db = require('../../config/database');
const xlsx = require('xlsx');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const uomController = {
  // Get all UOMs
  async getAll(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM ims.t_uom WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC'
      );
      
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'UOMs retrieved successfully'
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

  // Get UOM by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_uom WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'UOM not found',
          devMessage: 'No UOM found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'UOM retrieved successfully'
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

  // Create UOM
  async create(req, res) {
    try {

      const { uom_name, description } = req.body;
      // Make description optional
      const desc = description !== undefined ? description : null;

      const result = await db.query(
        `INSERT INTO ims.t_uom (uom_name, description, created_by) 
         VALUES ($1, $2, $3) RETURNING *`,
        [uom_name, desc, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'UOM created successfully'
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

  // Update UOM (partial updates supported)
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
        `UPDATE ims.t_uom SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'UOM not found',
          devMessage: 'No UOM found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'UOM updated successfully'
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

  // Delete UOM (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_uom SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'UOM not found',
          devMessage: 'No UOM found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'UOM deleted successfully'
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

  // Bulk insert UOMs
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const uoms = req.body;
      const insertedUoms = [];

      for (const uom of uoms) {
        const { uom_name, description } = uom;
        // Make description optional
        const desc = description !== undefined ? description : null;
        const result = await client.query(
          `INSERT INTO ims.t_uom (uom_name, description, created_by) 
           VALUES ($1, $2, $3) RETURNING *`,
          [uom_name, desc, CREATED_BY]
        );
        insertedUoms.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedUoms,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedUoms.length} UOMs inserted successfully`
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

  // Process uploaded Excel and bulk insert UOMs
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

      const uomNameIndex = headers.indexOf('uom name');
      const descriptionIndex = headers.indexOf('description');

      if (uomNameIndex === -1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'UOM Name column is missing',
          devMessage: 'UOM Name column not found in the uploaded Excel file'
        });
      }

      await client.query('BEGIN');
      const insertedUoms = [];

      let currentTimestamp = new Date(); // Start with the current timestamp

      for (const row of rows) {
        const uom_name = row[uomNameIndex]?.trim();
        const description = row[descriptionIndex]?.trim();

        if (!uom_name) {
          throw new Error('UOM Name is required in each row');
        }

        const desc = description !== undefined ? description : null;
        const created_at = currentTimestamp.toISOString().replace('T', ' ').replace('Z', ' +0000');
        currentTimestamp = new Date(currentTimestamp.getTime() + 10); // Increment by 1 millisecond

        const result = await client.query(
          `INSERT INTO ims.t_uom (uom_name, description, created_by, created_at) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [uom_name, desc, CREATED_BY, created_at]
        );
        insertedUoms.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedUoms,
        clientMessage: 'Excel data processed and inserted successfully',
        devMessage: `${insertedUoms.length} UOMs inserted successfully`
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

  // Export all UOMs to Excel
  async exportToExcel(req, res) {
    try {
      // Fetch all UOM data
      const result = await db.query(
        'SELECT id, uom_code, uom_name, description, is_active, is_deleted FROM ims.t_uom ORDER BY created_at DESC'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'No UOM data found',
          devMessage: 'No data available in the UOM table'
        });
      }

      // Prepare Excel data
      const headers = [
        'ID',
        'UOM Code',
        'UOM Name',
        'Description',
        'Is Active',
        'Is Deleted'
      ];

      const rows = result.rows.map(row => [
        row.id,
        row.uom_code,
        row.uom_name,
        row.description,
        row.is_active ? 'Yes' : 'No',
        row.is_deleted ? 'Yes' : 'No'
      ]);

      // Create a new workbook and worksheet
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

      // Append the worksheet to the workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'UOMs');

      // Write the workbook to a buffer
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for file download
      res.setHeader('Content-Disposition', 'attachment; filename="uoms.xlsx"');
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

module.exports = uomController;