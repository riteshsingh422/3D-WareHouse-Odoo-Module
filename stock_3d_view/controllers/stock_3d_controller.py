from odoo import http
from odoo.http import request


class Stock3DController(http.Controller):

    @http.route('/3Dstock/data/product_location', type='json', auth='user')
    def get_product_location_data(self, product_id, company_id):
        """Fetch the location(s) where the product is stored and the product's 3D properties."""
        # Ensure the user has access to the product and company
        product = request.env['product.template'].sudo().browse(int(product_id))
        if not product.exists():
            return {'error': 'Product not found'}

        # Fetch stock quantities (stock.quant) for the product
        # We need to get the product.product IDs for this product.template
        product_variants = request.env['product.product'].sudo().search([
            ('product_tmpl_id', '=', product.id),
            ('company_id', '=', int(company_id)),
        ])
        quants = request.env['stock.quant'].sudo().search([
            ('product_id', 'in', product_variants.ids),
            ('quantity', '>', 0),
            ('company_id', '=', int(company_id)),
        ])

        # Prepare location data in the same format as /3Dstock/data/standalone
        locations = {}
        for quant in quants:
            location = quant.location_id
            if location.usage != 'internal':
                continue
            # Format: {location_code: [pos_x, pos_y, pos_z, length, width, height, loc_id]}
            locations[location.complete_name] = [
                location.pos_x or 0,
                location.pos_y or 0,
                location.pos_z or 0,
                location.length or 0,
                location.width or 0,
                location.height or 0,
                location.id,
            ]

        # Fetch product 3D properties and name
        product_data = {
            'length': product.length or 0,
            'width': product.width or 0,
            'height': product.height or 0,
            'pos_x': product.pos_x or 0,
            'pos_y': product.pos_y or 0,
            'pos_z': product.pos_z or 0,
            'name': product.name,  # Add the product name
        }

        return {
            'locations': locations,
            'product': product_data,
        }