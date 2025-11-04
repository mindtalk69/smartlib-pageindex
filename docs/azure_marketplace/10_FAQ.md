# SmartLib Frequently Asked Questions (FAQ)

## General Questions

### What is SmartLib?
SmartLib is a Retrieval-Augmented Generation (RAG) platform that helps organizations extract insights from their documents. It combines advanced document processing with AI to enable intelligent search and interactive chat with your document knowledge base.

### What document types does SmartLib support?
SmartLib supports a wide range of document formats including PDF, DOCX, DOC, TXT, RTF, PPT, PPTX, HTML, XML, CSV, XLS, XLSX, and image files (JPG, PNG, TIFF) containing text.

### How is SmartLib different from a traditional search engine?
Unlike traditional keyword-based search engines, SmartLib uses semantic understanding to comprehend the meaning behind your queries, not just match keywords. It also provides an AI-powered chat interface that can answer complex questions using your documents as context.

## Subscription and Pricing

### What subscription plans are available?
We offer three main tiers:
- **Basic**: For small teams with up to 10 users and 5,000 pages of documents
- **Professional**: For medium-sized teams with up to 50 users and 50,000 pages
- **Enterprise**: For large organizations with unlimited users and 500,000+ pages

### How is SmartLib priced?
SmartLib follows a subscription-based pricing model through Azure Marketplace. You can choose monthly or annual billing, with annual subscriptions offering a 15% discount. Each plan includes a base number of users and document pages, with the ability to purchase additional capacity.

### Do I need an Azure subscription to use SmartLib?
Yes, you need an active Azure subscription to purchase and deploy SmartLib through the Azure Marketplace. The subscription charges will appear on your Azure bill.

### Can I change plans later?
Yes, you can upgrade or downgrade your plan at any time through the Azure Portal. Upgrades take effect immediately, while downgrades take effect at the end of the current billing cycle.

## Technical Requirements

### What are the minimum technical requirements?
SmartLib is a SaaS offering that runs on our managed Azure infrastructure. You only need a modern web browser (Chrome, Edge, Firefox, or Safari) to access the application.

### Do I need to install any software?
No installation is required on your end. SmartLib is fully cloud-based and accessed through your web browser.

### Does SmartLib require Azure OpenAI access?
No, SmartLib comes with pre-configured Azure OpenAI integration. You don't need your own Azure OpenAI resource or API keys.

### Can I use my own Azure OpenAI deployment?
Yes, Enterprise plan customers can configure SmartLib to use their own Azure OpenAI deployment if preferred, which gives you more control over models and token usage.

## Deployment and Setup

### How long does deployment take?
Initial deployment typically takes 15-30 minutes from the time you complete the subscription process in Azure Marketplace.

### Can I deploy SmartLib in my own Azure subscription?
SmartLib is offered as a SaaS application running on our infrastructure. If you need a private instance running in your own subscription, please contact our sales team about our "Dedicated" offering.

### Is there a trial available?
Yes, we offer a 14-day free trial with full functionality for up to 5 users and 1,000 pages. No credit card is required to start the trial.

### How do I migrate from the trial to a paid subscription?
At the end of your trial, you'll be prompted to select a subscription plan. Your data and configurations will be preserved when transitioning to a paid plan.

## Data Management and Security

### Where is my data stored?
Your data is stored in the Azure region you select during setup. We support multiple regions globally to help you meet data residency requirements.

### Is my data shared with other customers?
No. Each customer's data is logically isolated and never shared with other customers. We maintain strict tenant separation.

### How is my data secured?
SmartLib employs multiple security layers including:
- Encryption for data at rest and in transit (TLS 1.2+)
- Regular security audits and penetration testing
- Azure Active Directory integration for authentication
- Role-based access controls
- Private networking options for Enterprise plans

### Does SmartLib comply with GDPR/HIPAA/other regulations?
SmartLib is designed with privacy and compliance in mind. We offer GDPR compliance for all customers. For regulated industries requiring HIPAA, FedRAMP, or other specific compliance frameworks, please contact us about our Enterprise compliance add-on packages.

## Integration and Connectivity

### Can SmartLib integrate with Azure Active Directory?
Yes, all plans support Azure AD integration for single sign-on. Enterprise plans additionally support advanced features like conditional access and group synchronization.

### Can I connect SmartLib to my existing document repositories?
Yes, SmartLib can connect to:
- SharePoint Online
- OneDrive for Business
- Azure Blob Storage
- Google Drive (Enterprise plan only)
- Network file shares via Azure File Sync (Enterprise plan only)

### Does SmartLib have an API?
Yes, Professional and Enterprise plans include API access for programmatic document upload, search, and retrieval operations.

## Document Processing

### How are documents processed?
When you upload documents, SmartLib:
1. Extracts text using OCR for images and scanned documents
2. Splits content into appropriate chunks
3. Generates vector embeddings for semantic search
4. Indexes the content for quick retrieval
5. Makes the document searchable and available for chat

### What OCR options are available?
SmartLib offers two OCR processing options:
- **Local OCR**: Built-in capabilities good for basic text extraction
- **Azure Document Intelligence**: Advanced OCR with superior accuracy for complex documents, handwriting, and tables

### How long does document processing take?
Processing time depends on document complexity:
- Simple text documents: 1-5 seconds per page
- Complex documents with images and tables: 5-15 seconds per page
- Large batches are processed in parallel for efficiency

### What languages does SmartLib support?
The user interface is available in English, Spanish, French, German, Japanese, and Chinese. Document processing supports 164+ languages with Azure Document Intelligence.

## Usage and Administration

### How do I add users to my SmartLib instance?
Administrators can add users through the Admin > Users section. You can add users individually or in bulk by uploading a CSV file. Professional and Enterprise plans also support Azure AD group synchronization.

### Can I create multiple knowledge bases?
Yes, all plans support multiple knowledge bases (called "Collections") to organize documents by department, project, or any other structure you prefer.

### How do I control who can access specific documents?
SmartLib provides role-based access control. You can:
- Assign users to specific groups
- Grant groups access to specific Collections
- Set permissions for viewing, editing, or administering content
- Create custom roles with precise permission sets (Enterprise plan)

### Can users collaborate on documents?
Yes, users can:
- Share search results and chat conversations
- Add comments and annotations to documents
- Create shared Collections for team access
- Set up automated alerts for new relevant content

## Support and Maintenance

### What support is included?
All plans include:
- Email support with 24-hour response time
- Access to documentation and knowledge base
- Regular platform updates

Professional plans add:
- 8-hour business day response time
- Phone support during business hours

Enterprise plans add:
- 4-hour response time 24/7/365
- Dedicated customer success manager
- Quarterly business reviews

### How often is SmartLib updated?
SmartLib receives feature updates monthly and security patches as needed. Updates are deployed without downtime in most cases.

### Is there downtime for maintenance?
Planned maintenance is rare and scheduled during non-business hours with advance notice. Our architecture is designed for high availability with redundancy across multiple availability zones.

### How do I get help if I have questions?
You can:
- Browse our comprehensive documentation at docs.smartlib.com
- Contact support through the in-app help widget
- Email support@smartlib.com
- Open a support ticket through Azure if it's related to your subscription

## Getting Started

### How quickly can I start seeing value from SmartLib?
Most customers upload their first documents and begin searching within an hour of deployment. The system becomes more valuable as you add more documents to build a comprehensive knowledge base.

### Is training required to use SmartLib?
The interface is intuitive and requires minimal training. We provide getting started guides and video tutorials. Enterprise customers receive complimentary onboarding sessions.

### How can I maximize ROI from SmartLib?
For best results:
1. Start with high-value document sets that are frequently referenced
2. Organize documents into logical Collections
3. Train your team on effective search and chat techniques
4. Use the analytics dashboard to identify popular content and search patterns
5. Regularly review and refine your knowledge base structure

### How can I request a feature or integration?
We welcome feature requests! You can submit ideas through:
- The feedback button in the application
- Your account manager (Enterprise plans)
- Our public roadmap voting system at feedback.smartlib.com

## Technical Support

### What should I do if I encounter an error?
Start by checking our troubleshooting guide in the help center. If that doesn't resolve your issue, contact support with:
1. A detailed description of the problem
2. Steps to reproduce the issue
3. Screenshots or error messages
4. Document examples (if applicable)

### Who do I contact for billing questions?
For subscription and billing inquiries, contact billing@smartlib.com or submit a request through the Azure Portal billing support section.

### Is phone support available?
Phone support is available for Professional and Enterprise plans. Basic plan customers can purchase phone support as an add-on.

### What are your support hours?
- Basic plan: Email support Monday-Friday, 9am-5pm ET
- Professional plan: Email and phone support Monday-Friday, 8am-8pm ET
- Enterprise plan: 24/7/365 support via email, phone, and dedicated Slack channel