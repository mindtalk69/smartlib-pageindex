# Connecting to SmartLib: Azure Marketplace SaaS Offer

## Overview

This guide provides step-by-step instructions for customers to subscribe to your SmartLib SaaS offering through the Azure Marketplace, activate their instance, and begin using the platform.

## Subscription Process

### Step 1: Find and Subscribe

1. Visit the **Azure Marketplace** and search for "SmartLib" or use the direct link provided
2. Select the SmartLib offer that matches your requirements
3. Click **Get It Now** or **Subscribe** 
4. Select your **Subscription**, **Resource Group**, and **Name** for the SaaS resource
5. Review the terms, pricing, and click **Subscribe**
6. Wait for the subscription process to complete (typically 1-2 minutes)

![Subscription process screenshot](subscription_screenshot.png)

### Step 2: Configure and Activate Your Instance

1. Once subscription is complete, click **Configure account now** in the success message
   - Or navigate to the SaaS resource in your Azure Portal and click **Configure**
2. You'll be redirected to SmartLib's landing page to complete the setup
3. Fill in the activation form:
   - **Organization Name**: Your company or team name
   - **Administrator Email**: Email for the primary admin account
   - **Deployment Region**: Select your preferred Azure region
   - **Instance Size**: Choose based on your document volume needs
4. Click **Provision My Instance** to start the deployment
5. You'll receive a confirmation email with the provisioning status
   - Provisioning typically takes 15-30 minutes to complete

![Activation form screenshot](activation_form.png)

### Step 3: Access Your SmartLib Instance

1. When provisioning is complete, you'll receive an email with:
   - Your unique SmartLib URL: `https://[your-instance-name].smartlib.com`
   - Temporary admin password
   - Getting started resources
2. Click the link in the email or navigate directly to your instance URL
3. Log in with:
   - **Username**: The email address you provided during activation
   - **Password**: The temporary password from the email
4. You'll be prompted to change your password on first login

![First login screenshot](first_login.png)

## Initial Setup

### Step 1: Complete the Setup Wizard

After your first login, the setup wizard will guide you through:

1. **Profile Completion**: Update your administrator profile
2. **Organization Settings**: Configure your organization details
3. **Upload First Document**: Start building your knowledge base
4. **Invite Users**: Add your team members

### Step 2: Configure Integrations (Optional)

#### Azure Active Directory Integration

To enable single sign-on with your organization's Azure AD:

1. Navigate to **Admin > Settings > Authentication**
2. Click **Configure Azure AD**
3. Follow the guided setup process to connect your Azure AD tenant
4. Enable or customize sync options for users and groups

> **Provisioning note:** During Azure Marketplace deployments, the web app automatically falls back to the value of the platform-provided `WEBSITE_HOSTNAME` when building the Entra redirect URI (`https://<hostname>/login_azure`). Ensure the same hostname is registered as a redirect URI in your Entra application, or override `REDIRECT_URI` via App Settings if you need a custom domain. ARM templates can set this value automatically using the generated site name.

#### Document Intelligence Setup

SmartLib offers two OCR processing options:

1. Navigate to **Admin > OCR**
2. Choose between:
   - **Local OCR**: Built-in capabilities (default)
   - **Azure Document Intelligence**: Advanced OCR with superior accuracy
3. If selecting Azure Document Intelligence, verify the connection is already configured through the deployment

#### External Storage Connection (Optional)

To use your own Azure Storage account for documents:

1. Navigate to **Admin > Settings > Storage**
2. Click **Connect External Storage**
3. Select **Azure Blob Storage**
4. Enter your storage account connection details
5. Click **Test Connection** and then **Save**

## Managing Your Subscription

### Viewing Subscription Details

1. Visit the **Azure Portal** and navigate to your SmartLib SaaS resource
2. The **Overview** tab shows your subscription status, plan, and usage metrics
3. View billing information in the **Cost Management** section

### Changing Your Plan

1. Visit the **Azure Portal** and navigate to your SmartLib SaaS resource
2. Click **Plan + Pricing** in the left menu
3. Select your new plan and click **Change Plan**
4. Your instance will be updated automatically with the new plan specifications

### Managing Users and Licenses

1. Your subscription includes a specific number of user licenses based on your plan
2. Add users through **Admin > Users > Add User** in the SmartLib interface
3. Monitor license usage in **Admin > Dashboard > License Usage**
4. Purchase additional licenses through the Azure Marketplace if needed

## Support Resources

### Documentation and Help

- In-app help is available by clicking the **?** icon in the top right corner
- Comprehensive documentation is available at https://docs.smartlib.com
- Video tutorials are available at https://smartlib.com/tutorials

### Getting Support

- **Technical Support**: support@smartlib.com or through the in-app help widget
- **Billing Questions**: billing@smartlib.com or through Azure Support
- **Azure Marketplace Support**: For subscription-related issues, contact through the Azure Portal

For expedited assistance, please include your Azure Subscription ID and SmartLib instance name in all communications.

## Trial to Paid Conversion

If you started with a trial:

1. Before your trial expires, you'll receive email reminders with conversion options
2. To convert to a paid plan:
   - Navigate to your SaaS resource in Azure Portal
   - Click **Plan + Pricing**
   - Select your desired plan and complete the purchase
3. Your data and configurations will automatically transfer to your paid subscription

## Cancellation Process

If you need to cancel your subscription:

1. Navigate to your SmartLib SaaS resource in Azure Portal
2. Click **Plan + Pricing**
3. Select **Cancel subscription**
4. Follow the prompts to complete cancellation
5. Your data will be retained for 30 days after cancellation, during which time you can reactivate your subscription

## Next Steps

After completing your subscription and initial setup, we recommend:

1. **Upload Key Documents**: Begin with your most important documents
2. **Create Knowledge Bases**: Organize documents into logical collections
3. **Invite Team Members**: Share the power of SmartLib with your colleagues
4. **Explore Search and Chat**: Experience the AI-powered search and chat capabilities
5. **Schedule a Training Session**: Contact support to arrange a personalized training session

Thank you for choosing SmartLib! We're excited to help you unlock the knowledge in your documents.