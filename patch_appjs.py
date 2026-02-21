import re

with open('static/assets/mazer/compiled/js/app.js', 'r') as f:
    content = f.read()

# Fix the first error: Uncaught TypeError: Cannot read properties of null (reading 'clientHeight')
# Original code: const u=~~[...a.querySelectorAll(".submenu-link")].reduce((p,h)=>p+h.clientHeight,0);
# Replacement:   const u=~~[...a.querySelectorAll(".submenu-link")].reduce((p,h)=>p+(h?h.clientHeight:0),0);
content = content.replace(
    'const u=~~[...a.querySelectorAll(".submenu-link")].reduce((p,h)=>p+h.clientHeight,0);',
    'const u=~~[...a.querySelectorAll(".submenu-link")].reduce((p,h)=>p+(h?h.clientHeight:0),0);'
)

# Fix the second error: Uncaught TypeError: Cannot read properties of null (reading 'clientHeight')
# Original code: if(f+=l.querySelector(".submenu-link").clientHeight,k&&l.classList.contains("has-sub"))
# Replacement:   if(f+=(l.querySelector(".submenu-link")?l.querySelector(".submenu-link").clientHeight:0),k&&l.classList.contains("has-sub"))
content = content.replace(
    'if(f+=l.querySelector(".submenu-link").clientHeight,k&&l.classList.contains("has-sub"))',
    'if(f+=(l.querySelector(".submenu-link")?l.querySelector(".submenu-link").clientHeight:0),k&&l.classList.contains("has-sub"))'
)

with open('static/assets/mazer/compiled/js/app.js', 'w') as f:
    f.write(content)

print("app.js patched successfully")
