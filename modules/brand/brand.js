const db = require('../../config/database');
const xlsx = require('xlsx');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const brandController = {
  // Get all brands
  async getAll(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM ims.t_brand WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC'
      );
      
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'Brands retrieved successfully'
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

  // Get brand by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_brand WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Brand not found',
          devMessage: 'No brand found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'Brand retrieved successfully'
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

  // Create brand
  async create(req, res) {
    try {

      const { brand_name, description, logo_url } = req.body;
      // Make description and logo_url optional
      const desc = description !== undefined ? description : null;
      const logo = logo_url !== undefined ? logo_url : null;

      const result = await db.query(
        `INSERT INTO ims.t_brand (brand_name, description, logo_url, created_by) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [brand_name, desc, logo, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'Brand created successfully'
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

  // Update brand (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;
      
      // Remove null/undefined values and build dynamic query
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

      // Add updated_at and updated_by
      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;

      const setClause = Object.keys(validFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(validFields)];

      const result = await db.query(
        `UPDATE ims.t_brand SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Brand not found',
          devMessage: 'No brand found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'Brand updated successfully'
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

  // Delete brand (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_brand SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Brand not found',
          devMessage: 'No brand found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'Brand deleted successfully'
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

  // Bulk insert brands
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const brands = req.body; // Expecting array of brand objects
      const insertedBrands = [];

      for (const brand of brands) {
        const { brand_name, description, logo_url } = brand;
        // Make description and logo_url optional
        const desc = description !== undefined ? description : null;
        const logo = logo_url !== undefined ? logo_url : null;
        const result = await client.query(
          `INSERT INTO ims.t_brand (brand_name, description, logo_url, created_by) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [brand_name, desc, logo, CREATED_BY]
        );
        insertedBrands.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedBrands,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedBrands.length} brands inserted successfully`
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

  // Process uploaded Excel and bulk insert brands
  async processExcelAndBulkInsert(req, res) {
    const client = await db.getClient();
    console.log("inside...")
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
      console.log('Processing sheet:', sheetName);
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      console.log('Excel Data:', sheetData);

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
      console.log('Excel Headers:', headers);
      const rows = sheetData.slice(1);

      const brandNameIndex = headers.indexOf('Brand Name'.toLowerCase());
      const descriptionIndex = headers.indexOf('Description'.toLowerCase());

      if (brandNameIndex === -1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'Brand Name column is missing',
          devMessage: 'Brand Name column not found in the uploaded Excel file'
        });
      }

      await client.query('BEGIN');
      const insertedBrands = [];

      let currentTimestamp = new Date(); // Start with the current timestamp

      for (const row of rows) {
        const brand_name = row[brandNameIndex]?.trim();
        const description = row[descriptionIndex]?.trim();
        console.log("row inside loop:", row);

        if (!brand_name) {
          throw new Error('Brand Name is required in each row');
        }

        const desc = description !== undefined ? description : null;
        const created_at = currentTimestamp.toISOString().replace('T', ' ').replace('Z', ' +0000');
        currentTimestamp = new Date(currentTimestamp.getTime() + 10); // Increment by 1 millisecond
        console.log("current timestamp:", currentTimestamp);
        const result = await client.query(
          `INSERT INTO ims.t_brand (brand_name, description, created_by, created_at) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [brand_name, desc, CREATED_BY, created_at]
        );
        insertedBrands.push(result.rows[0]);
        console.log(`Inserted brand: ${JSON.stringify(result.rows[0])}`);
      }

      console.log(`Total brands inserted: ${insertedBrands}`);

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedBrands,
        clientMessage: 'Excel data processed and inserted successfully',
        devMessage: `${insertedBrands.length} brands inserted successfully`
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

  // Export all brands to Excel
  async exportToExcel(req, res) {
    try {
      // Fetch all brand data
      const result = await db.query(
        'SELECT id, brand_code, brand_name, description, is_active, is_deleted FROM ims.t_brand ORDER BY created_at DESC'
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'No brand data found',
          devMessage: 'No data available in the brand table'
        });
      }

      // Prepare Excel data
      const headers = [
        'ID',
        'Brand Code',
        'Brand Name',
        'Description',
        'Is Active',
        'Is Deleted'
      ];

      const rows = result.rows.map(row => [
        row.id,
        row.brand_code,
        row.brand_name,
        row.description,
        row.is_active ? 'Yes' : 'No',
        row.is_deleted ? 'Yes' : 'No'
      ]);

      // Apply styling to headers
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F81BD' } },
        alignment: { horizontal: 'center' }
      };

      // Create a new workbook and worksheet
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

      // Apply styles to header row
      const range = xlsx.utils.decode_range(worksheet['!ref']);
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        worksheet[cellAddress].s = headerStyle;
      }

      // Append the worksheet to the workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Brands');

      // Write the workbook to a buffer
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for file download
      res.setHeader('Content-Disposition', 'attachment; filename="brands.xlsx"');
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

module.exports = brandController;