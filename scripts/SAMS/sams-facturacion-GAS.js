const { chromium } = require('playwright');
const { isAwaitExpression } = require('typescript');

const datosSegundaPagina = {
  Razon: 'YAQUI RESTAURANTE BAR',
  Calle: 'REYNOSA-MONTERREY',
  NOext: '213-18, 19 Y 20',
  NoInt: 'SIN NUMERO',
  Ref: 'SIN REFERENCIA',
  Est: 'TAMAULIPAS',
  Deleg: 'REYNOSA',
  Col: 'VALLE ALTO',
  CP: '88710',
};

// Leer datos desde variable de entorno
let datos;
try {
  if (!process.env.INPUT_JSON) throw new Error('No se encontró la variable INPUT_JSON');
  datos = JSON.parse(process.env.INPUT_JSON);
} catch (error) {
  console.error(JSON.stringify({ success: false, message: 'Error al leer INPUT_JSON', error: error.message }));
  process.exit(1);
}

// Validar campos requeridos
const camposRequeridos = ['rfc', 'tc', 'tr', 'cp', 'tienda', 'correo'];
for (const campo of camposRequeridos) {
  if (!datos[campo]) {
    console.error(JSON.stringify({ success: false, message: `Campo requerido faltante: ${campo}` }));
    process.exit(1);
  }
}
datos.folio = datos.tc;

async function procesarFacturacion(datos) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    if (datos.tienda !== 'Sams' && datos.tienda !== 'Walmart') {
      throw new Error(`Tienda no soportada: ${datos.tienda}`);
    }

    await page.goto('https://facturacion.walmartmexico.com.mx/frmDatos.aspx', { waitUntil: 'domcontentloaded' });

    // Cerrar modal si aparece
    try {
      const aceptarButton = await page.waitForSelector('button:has-text("Aceptar")', { timeout: 3000 });
      if (aceptarButton) await aceptarButton.click();
    } catch {}

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 🛠 Buscar botón "Obtener Factura" con tolerancia
    try {
      console.log('Buscando botón "Obtener Factura"...');
      let btn = await page.$('a[href="frmDatos.aspx"][onclick="venproc()"]');

      if (!btn) {
        btn = await page.locator('a:has-text("Obtener factura")').first();
      }

      if (btn) {
        console.log('✓ Botón encontrado, haciendo clic...');
        await btn.click();
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠ Botón "Obtener Factura" no encontrado. Puede que ya estés en el formulario.');
      }
    } catch (error) {
      console.log('⚠ Error buscando botón "Obtener Factura":', error.message);
    }

    // ✅ Función con 3 intentos para llenar campos
    async function llenarCampo(selector, valor) {
      for (let intento = 1; intento <= 3; intento++) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.focus(selector);
          await page.fill(selector, '');
          await page.waitForTimeout(300);
          await page.type(selector, valor.toString(), { delay: 50 });
          await page.waitForTimeout(500);

          const valorActual = await page.inputValue(selector);
          if (valorActual === valor.toString()) {
            console.log(`✓ Campo ${selector} escrito correctamente: ${valor}`);
            return;
          } else {
            console.log(`⚠ Intento ${intento} fallido. Esperado: "${valor}", Actual: "${valorActual}"`);
          }
        } catch (error) {
          console.log(`⚠ Error en intento ${intento} para selector ${selector}: ${error.message}`);
        }

        if (intento < 3) {
          await page.waitForTimeout(1000);
        } else {
          throw new Error(`❌ No se pudo escribir correctamente el campo ${selector} después de 3 intentos`);
        }
      }
    }

    // 👉 Llenar campos de la primera página
    await llenarCampo('#ctl00_ContentPlaceHolder1_txtMemRFC', datos.rfc);
    await llenarCampo('#ctl00_ContentPlaceHolder1_txtTC', datos.folio);
    await llenarCampo('#ctl00_ContentPlaceHolder1_txtTR', datos.tr);
    await llenarCampo('#ctl00_ContentPlaceHolder1_txtCP', datos.cp);
    await page.click('#ctl00_ContentPlaceHolder1_btnAceptar');
    await page.waitForTimeout(3000);

    // Verificar si estamos en segunda página
    const enSegunda = await page.locator('#ctl00_ContentPlaceHolder1_txtRazon').isVisible().catch(() => false);
    if (enSegunda) {
      console.log('✓ Llenando segunda página...');
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtRazon', datosSegundaPagina.Razon);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtCalle', datosSegundaPagina.Calle);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtCP', datosSegundaPagina.CP);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtNumExt', datosSegundaPagina.NOext);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtNumInt', datosSegundaPagina.NoInt);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtEstado', datosSegundaPagina.Est);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtMunicipio', datosSegundaPagina.Deleg);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtColonia', datosSegundaPagina.Col);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtEmail', datos.correo);
      await llenarCampo('#ctl00_ContentPlaceHolder1_txtReferencia', datosSegundaPagina.Ref);

      await page.selectOption('#ctl00_ContentPlaceHolder1_ddlregimenFiscal', 'General de Ley Personas Morales');
      await page.selectOption('#ctl00_ContentPlaceHolder1_ddlusoCFDI', 'Gastos en general');  //hacer cambio aqui al subir archivo

      // Función para intentar seleccionar tipo de pago en cualquier momento
      async function intentarSeleccionarPago() {
        try {
          const paymentSelector = '#ctl00_ContentPlaceHolder1_ddlPaymentType';
          const elemento = await page.$(paymentSelector);
          if (elemento) {
            console.log('✓ Dropdown de pago encontrado, seleccionando Tarjeta de débito...');
            await page.selectOption(paymentSelector, '28');
            await page.waitForTimeout(1000);
            return true;
          }
        } catch (error) {
          console.log('⚠ Error intentando seleccionar pago:', error.message);
        }
        return false;
      }

      async function intentarContinuar() {
        try{
          const continueSelector = '#ctl00_ContentPlaceHolder1_btnContinuar';
          const elemento = await page.$(continueSelector);
          if(elemento){
            console.log('boton continuar encontrado');
            await page.click(continueSelector);
            await page.waitForTimeout(1000);
            return true;
          }
        } catch (error){
           console.log('Error intentando seleccionar boton') 
          }
          return false;
      }

      // Función final para pulsar el botón "Facturar"
      async function intentarFacturar() {
        try {
          const facturarSelector = '#ctl00_ContentPlaceHolder1_btnFacturar';
          const elemento = await page.$(facturarSelector);
          if (elemento) {
          console.log('✓ Botón "Facturar" encontrado, haciendo clic...');
          await page.click(facturarSelector);
          await page.waitForTimeout(1500);
          return true;
          }
          
        } catch (error) {
          console.log('⚠ Error intentando hacer clic en "Facturar":', error.message);
        }
          return false;
}


      // Función de debug para ver qué elementos están disponibles
      async function debugElementos() {
        const url = await page.url();
        const title = await page.title();
        console.log(`📍 URL actual: ${url}`);
        console.log(`📄 Título: ${title}`);
        
        // Buscar dropdowns disponibles
        const dropdowns = await page.$('select');
        console.log(`🔍 Dropdowns encontrados: ${dropdowns.length}`);
        for (let i = 0; i < dropdowns.length; i++) {
          const id = await dropdowns[i].getAttribute('id');
          const name = await dropdowns[i].getAttribute('name');
          console.log(`  - Dropdown ${i}: id="${id}", name="${name}"`);
        }
      }

      await page.click('#ctl00_ContentPlaceHolder1_btnAceptar');
      await page.waitForTimeout(2000);
      await intentarSeleccionarPago(); // Intento 1
      await intentarContinuar();
      await intentarFacturar();
      
      await page.click('#ctl00_btnContinuar');
      await page.waitForTimeout(2000);
      await intentarSeleccionarPago(); // Intento 2
      await intentarContinuar();
      await intentarFacturar();
      
      await page.click('#ctl00_ContentPlaceHolder1_btnAceptar');
      await page.waitForTimeout(2000);
      await intentarSeleccionarPago(); // Intento 3
      await intentarContinuar();
      await intentarFacturar();
      
      await page.click('#ctl00_btnContinuar');
      await page.waitForTimeout(2000);
      await intentarSeleccionarPago(); // Intento 4
      await intentarContinuar();
      await intentarFacturar();
      
      await page.click('#ctl00_ContentPlaceHolder1_grvRFC_ctl11_lnkSeleccionar');
      await page.waitForTimeout(2000);
      await intentarSeleccionarPago(); // Intento 5
      await intentarContinuar();
      await intentarFacturar();
      
      await page.click('#ctl00_ContentPlaceHolder1_btnFacturar');
      await page.waitForTimeout(3000);
      await debugElementos(); // Debug después de facturar
      await intentarSeleccionarPago(); // Intento 6
      await intentarContinuar();
      await intentarFacturar();
      
      await page.click('#ctl00_ContentPlaceHolder1_btnCerrar');
      await page.waitForTimeout(3000);
      await debugElementos(); // Debug después de cerrar
      await intentarSeleccionarPago(); // Intento 7
      await intentarContinuar();
      await intentarFacturar();
      await page.click('#ctl00_ContentPlaceHolder1_btnFacturar');
      await page.click('#ctl00_ContentPlaceHolder1_btnFacturar');
      await page.waitForTimeout(1500); // espera corta para que procese
      

      // Buscar botón de envío final
      try {
        const botonEnvio = await page.locator('#ctl00_ContentPlaceHolder1_btnEnviar, #MainContent_btnEnviar, button[type="submit"]').first();
        if (await botonEnvio.isVisible()) {
          console.log('✓ Enviando factura...');
          await botonEnvio.click();
          await page.waitForTimeout(3000);
        }
      } catch (error) {
        console.log('⚠ No se encontró botón de envío:', error.message);
      }
    }

    // Obtener mensaje final
    const mensaje = await page.textContent('#MainContent_lblMensaje').catch(() => 'Sin mensaje');
    return { success: true, message: mensaje?.trim() || 'Proceso completado' };
    
  } catch (error) {
    console.error('Error durante el proceso:', error.message);
    return { success: false, message: error.message };
  } finally {
    await browser.close();
  }
}

// 🔁 Ejecutar
procesarFacturacion(datos)
  .then(res => console.log(JSON.stringify(res)))
  .catch(err => {
    console.error(JSON.stringify({ success: false, message: err.message }));
    process.exit(1);
  });
  