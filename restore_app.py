import os
import re

# Paths
brain_dir = r"C:\Users\Sharavanan Rajadurai\.gemini\antigravity\brain\0ef5e8ba-e49a-44bd-9a2e-8387752af889"
project_dir = r"d:\Development\Projects\Print E\printe-admin\printeg-admin-dashboard"
clean_base_path = os.path.join(brain_dir, "new_app_content.tsx.txt")
iot_script_path = os.path.join(project_dir, "iot_script.txt")
target_path = os.path.join(project_dir, "App.tsx")

with open(clean_base_path, 'r', encoding='utf-8') as f:
    content = f.read()

with open(iot_script_path, 'r', encoding='utf-8') as f:
    iot_script_content = f.read()

# 1. Imports
content = content.replace(
    "import React, { useState, useEffect, useMemo, memo } from 'react';",
    "import React, { useState, useEffect, useMemo, memo } from 'react';\nimport JSZip from 'jszip';"
)
content = content.replace(
    "  addDoc,",
    "  addDoc,\n  setDoc,"
)

# 2. PYTHON_SCRIPT_TEMPLATE
python_script_block = f"const PYTHON_SCRIPT_TEMPLATE = `" + iot_script_content + "`;"
content = content.replace(
    "const ITEMS_PER_PAGE = 5;",
    f"const ITEMS_PER_PAGE = 5;\n\n{python_script_block}"
)

# 3. handleOnboard readable ID
# We use a bit more flexible search to ensure match
onboard_search = """  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (!newShopName || !newLocation) return;
    if (!/^\\d{10}$/.test(phoneNumber)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }
    const newClient = {"""

onboard_replace = """  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (!newShopName || !newLocation) return;
    if (!/^\\d{10}$/.test(phoneNumber)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }
    const safeName = newShopName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const safeShopId = `${safeName}-${randomSuffix}`;
    const newClient = {
      id: safeShopId,"""

content = content.replace(onboard_search, onboard_replace)
content = content.replace("await addDoc(collection(db, 'clients'), newClient);", "await setDoc(doc(db, 'clients', safeShopId), newClient);")

# 4. handleAddPrinter readable ID
add_printer_else_search = """    } else {
      const newPrinterData = {
        name: printerName || `Printer ${Math.floor(Math.random() * 100)}`,"""

add_printer_else_replace = """    } else {
      const safePrinterId = `${printerName.toLowerCase().replace(/\\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newPrinterData = {
        id: safePrinterId,
        name: printerName || `Printer ${Math.floor(Math.random() * 100)}`,"""

content = content.replace(add_printer_else_search, add_printer_else_replace)

# Replace the addDoc part in handleAddPrinter
add_printer_adddoc_search = """      let newId = Math.random().toString(36).substr(2, 9);
      try {
        const dRef = await addDoc(collection(db, 'printers'), newPrinterData);
        newId = dRef.id;
      } catch (err) { console.error('Err add collection printer:', err); }
      updatedPrinters = [...(selectedClient.printers || []), { id: newId, ...newPrinterData }];"""

add_printer_setdoc_replace = """      try {
        await setDoc(doc(db, 'printers', safePrinterId), newPrinterData);
      } catch (err) { console.error('Err add collection printer:', err); }
      updatedPrinters = [...(selectedClient.printers || []), newPrinterData];"""

content = content.replace(add_printer_adddoc_search, add_printer_setdoc_replace)

# 5. handleDownloadConfig
download_handler = """  const handleDownloadConfig = async (client: Client, printer: any) => {
    const zip = new JSZip();
    const config = {
      shop_id: client.id,
      printer_id: printer.id,
      shop_name: client.shopName,
      printer_name: printer.name
    };
    zip.file("config.json", JSON.stringify(config, null, 2));
    zip.file("kiosk_pi.py", PYTHON_SCRIPT_TEMPLATE);
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${printer.id}-setup.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- RENDER ---"""

content = content.replace("// --- RENDER ---", download_handler)

# 6. UI: Download Button
# Using re.escape for safer matching if needed, but string replace is usually fine if exact
ui_buttons_search = """                      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur rounded-bl-xl border">
                        <button onClick={() => handleViewPrinter(printer)} className="p-1.5 text-slate-500 hover:text-black"><Eye size={14} /></button>
                        <button onClick={() => handleEditPrinter(printer)} className="p-1.5 text-slate-500 hover:text-black"><Pencil size={14} /></button>
                        <button onClick={() => handleDeletePrinter(printer.id)} className="p-1.5 text-rose-500"><Trash2 size={14} /></button>
                      </div>"""

ui_buttons_replace = """                      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur rounded-bl-xl border">
                        <button onClick={() => handleDownloadConfig(selectedClient, printer)} title="Download Config" className="p-1.5 text-blue-500 hover:text-blue-700"><Download size={14} /></button>
                        <button onClick={() => handleViewPrinter(printer)} className="p-1.5 text-slate-500 hover:text-black"><Eye size={14} /></button>
                        <button onClick={() => handleEditPrinter(printer)} className="p-1.5 text-slate-500 hover:text-black"><Pencil size={14} /></button>
                        <button onClick={() => handleDeletePrinter(printer.id)} className="p-1.5 text-rose-500"><Trash2 size={14} /></button>
                      </div>"""

content = content.replace(ui_buttons_search, ui_buttons_replace)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Successfully restored and updated {target_path}")
