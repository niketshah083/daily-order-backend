# WhatsApp Webhook Integration

## Overview
The WhatsApp Webhook integration allows users to interact with the system via WhatsApp Business API. Users can view orders, get order details, and place new orders through WhatsApp.

## Setup

### 1. Install WhatsApp SDK (Optional)
```bash
npm install whatsapp
```

**Note:** The system will work without the WhatsApp package installed. If the package is not available, WhatsApp features will be gracefully disabled with console warnings.

### 2. Environment Variables
Add to your `.env` file:
```
VERIFY_TOKEN=your-whatsapp-verify-token
```

### 3. WhatsApp Business API Configuration
1. Set up a WhatsApp Business Account
2. Configure webhook URL: `https://your-domain.com/whatsapp-webhook`
3. Set the verify token to match your `VERIFY_TOKEN` environment variable
4. Subscribe to message events

## API Endpoints

### 1. Verify Webhook (GET)
**GET** `/whatsapp-webhook`

Used by WhatsApp to verify your webhook endpoint during setup.

**Query Parameters:**
- `hub.mode`: Should be "subscribe"
- `hub.challenge`: Challenge token from WhatsApp
- `hub.verify_token`: Your verification token

**Response:**
- 200: Returns the challenge token if verification succeeds
- 403: Verification failed

### 2. Receive Webhook Events (POST)
**POST** `/whatsapp-webhook`

Receives incoming messages and events from WhatsApp.

**Request Body:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "field": "messages",
          "value": {
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.xxx",
                "type": "text",
                "text": {
                  "body": "Hello"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Features

### 1. User Authentication
- Users are identified by their mobile number
- Only registered users can interact with the system
- Unregistered users receive a "not registered" message

### 2. Role-Based Features

#### For Super Admin:
- View recent pending orders
- Get order details
- Access to admin-specific menu

#### For Distributors:
- Place orders through WhatsApp Flow
- View order confirmation

### 3. Message Types Supported

#### Text Messages
When a user sends any text message:
- System checks if user is registered
- Super admins receive a selection menu
- Distributors can initiate order flow

#### Interactive Messages

**List Reply:**
- Recent Orders: Shows last 5 pending orders
- Order Selection: View details of a specific order

**NFM Reply (Flow Response):**
- Order confirmation after placing order through WhatsApp Flow

## WhatsApp Utils Functions

### `sendTextMessage(toMobileNo, textMsg)`
Send a simple text message to a user.

### `setTypingIndicator(receivedMessageId)`
Show typing indicator to improve user experience.

### `sendOrderFlow(toMobileNo)`
Send WhatsApp Flow for placing orders.

### `sendDefaultSelectionListForAdmin(toMobileNo, customerName)`
Send interactive list menu for super admins.

### `sendLastFivePendingOrderList(toMobileNo, orders)`
Send list of recent pending orders.

### `sendOrderDetails(toMobileNo, orderInfo)`
Send formatted order details including:
- Order number
- Delivery window
- Total amount
- Distributor name
- Item list with quantities and prices

## Integration with Existing System

### Uses Our Services:
- `UserService.findByMobile()` - Find user by phone number
- `OrdersService.fetchLastFivePendingOrders()` - Get recent orders
- `OrdersService.fetchOrderInfoByOrderNo()` - Get order details

### Aligned with Structure:
- Uses `distributor` instead of `customer`
- Uses our UserEntity and OrderEntity
- Follows our module structure

## Message Flow Examples

### Example 1: Super Admin Views Orders
1. Admin sends any text message
2. System responds with selection menu
3. Admin selects "Recent Pending Orders"
4. System shows list of last 5 pending orders
5. Admin selects an order
6. System shows detailed order information

### Example 2: Distributor Places Order
1. Distributor sends any text message
2. System sends WhatsApp Flow for ordering
3. Distributor fills order form in Flow
4. System creates order
5. System sends order confirmation with order number

## Error Handling

The system gracefully handles:
- Missing WhatsApp package (logs warning, continues without WhatsApp features)
- Unregistered users (sends "not registered" message)
- Missing orders (sends "order not found" message)
- API errors (logs error, continues processing)

## Order Details Format

When sending order details via WhatsApp:
```
🧾 *Order Details*

*Order No:* ORD-1234567890
*Delivery Window:* EVENING
*Total Amount:* ₹1,500.50
*Created At:* 01/01/2024, 10:00:00 AM
*Distributor:* John Doe

📦 *Items:*
• Product A • 10 × ₹50.50 = ₹505.00
• Product B • 5 × ₹199.10 = ₹995.50

Thank you for ordering with us 🙏
```

## Configuration Notes

1. **WhatsApp Flow ID**: Update `flow_id` in `sendOrderFlow()` with your actual Flow ID
2. **Verify Token**: Must match between `.env` and WhatsApp Business settings
3. **Phone Numbers**: System uses last 10 digits for matching
4. **Timezone**: Uses Asia/Kolkata timezone for order windows

## Testing

### Test Webhook Verification:
```bash
curl "http://localhost:3000/whatsapp-webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your-whatsapp-verify-token"
```

### Test Webhook Event:
```bash
curl -X POST http://localhost:3000/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "messages": [{
            "from": "919876543210",
            "id": "wamid.test",
            "type": "text",
            "text": { "body": "Hello" }
          }]
        }
      }]
    }]
  }'
```

## Security Considerations

1. **Verify Token**: Use a strong, random token
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Consider adding rate limiting for webhook endpoint
4. **User Validation**: Always validate user exists before processing requests
5. **Error Messages**: Don't expose sensitive information in error messages

## Future Enhancements

Potential features to add:
1. Order status updates via WhatsApp
2. Payment confirmation messages
3. Delivery notifications
4. Catalog browsing through WhatsApp
5. Multi-language support
6. Order cancellation through WhatsApp
7. Customer support chat integration
