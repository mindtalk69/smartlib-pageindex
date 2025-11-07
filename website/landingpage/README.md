# SmartLib Landing Page

This directory contains the static landing page for SmartLib's Azure Marketplace offering.

## Files

- `index.html` - Main landing page with responsive design
- `style.css` - Modern CSS styling with animations and mobile support
- `script.js` - Interactive JavaScript functionality and analytics
- `logo.png` - SmartLib logo image

## Features

### Responsive Design
- Mobile-first approach with breakpoints at 768px and 480px
- Flexible grid layouts that adapt to screen size
- Touch-friendly navigation menu for mobile devices

### Content Sections
- **Hero Section**: Eye-catching introduction with call-to-action
- **Features**: Six key features with hover effects and descriptions
- **Architecture**: Visual workflow diagram showing the 4-step process
- **Get Started**: Azure Marketplace integration with benefits list
- **Contact**: Support and documentation links
- **Footer**: Comprehensive navigation and company information

### Interactive Elements
- Smooth scrolling navigation
- Fade-in animations on scroll
- Mobile menu toggle
- Loading states for external links
- Analytics tracking placeholders

### Accessibility
- Semantic HTML5 structure
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader friendly

### Performance
- Optimized CSS with efficient selectors
- Minimal JavaScript with event delegation
- Lazy loading for animations
- Debounced scroll handlers

## Customization

### Branding
Replace `logo.png` with your company logo. The current logo is referenced in:
- Header (40px height)
- Footer (30px height)

### Content
Edit the following sections in `index.html`:
- Hero title and subtitle
- Feature descriptions (6 features)
- Architecture steps
- Azure Marketplace link
- Contact information

### Styling
Modify `style.css` to change:
- Color scheme (primary: #2563eb)
- Typography (system font stack)
- Spacing and layout
- Animation timing

## Deployment

### Static Hosting
The landing page can be hosted on any static web server:
```bash
# Python simple server
python -m http.server 8000

# Node.js server
npx serve .

# Nginx/Apache
Copy files to web root
```

### Azure Deployment
For Azure Marketplace integration:
1. Deploy to Azure Static Web Apps
2. Configure custom domain if needed
3. Update Azure Marketplace listing with the URL
4. Ensure HTTPS is enabled

### Integration with Webhook
The landing page is designed to work alongside the webhook endpoint:
- Landing page provides marketing and information
- Webhook handles subscription lifecycle events
- Both can be deployed independently or together

## Testing

### Local Testing
```bash
# Open in browser
python -c "import webbrowser; webbrowser.open('file:///path/to/index.html')"

# Or use any local server
python -m http.server 8000
# Then visit http://localhost:8000
```

### Cross-browser Testing
Test in:
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Android Chrome)

## Analytics and Tracking

### Google Analytics
Replace the placeholder in `script.js`:
```javascript
// Replace this placeholder
if (typeof gtag !== 'undefined') {
    gtag('event', eventName, properties);
}
```

### Custom Events
The page tracks:
- Page load performance
- CTA button clicks
- Section views
- External link clicks
- JavaScript errors

## Security

### Content Security Policy
Add CSP headers if hosting with proper server configuration:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
```

### HTTPS
Ensure HTTPS in production:
- All links use protocol-relative URLs
- Mixed content warnings avoided
- Certificate valid and updated

## Maintenance

### Content Updates
- Update feature descriptions as product evolves
- Refresh architecture diagram if workflow changes
- Update pricing and plans information
- Keep contact information current

### Performance Monitoring
- Monitor Core Web Vitals
- Check Google PageSpeed Insights
- Optimize images and fonts
- Minimize bundle size if using build tools

## Browser Support

- Modern browsers (Chrome 60+, Firefox 55+, Safari 12+, Edge 79+)
- Graceful degradation for older browsers
- Progressive enhancement for advanced features

## License

This landing page is part of the SmartLib project and follows the same licensing terms as the main application.
