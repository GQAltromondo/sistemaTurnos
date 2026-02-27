sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    const tiposLinea = ["L1", "L2", "L3", "L4", "L5", "L6"];

    // 🔹 Regla única de negocio: categoría + duración según licencia
    function getShiftInfo(license) {
        const job = license.Jobcond;
        const tipo = license.Tipoequipo;
        const Patadic = license.Patadic;
        const Intercerr = license.Intercerr;

        // 🔍 CAMPOS PARA MANIOBRAS SIN CONSIGNACIÓN
        const interruptoresAbiertos = license.Interabier || "";
        const seccionadoresAbiertos = license.Seleccionad || "";

        // 🔍 CAMPO PARA TCT CON/SIN BLOQUEO
        const bloqueoRecierre = license.Bloqueo || "";

        let category = "Otro";
        let duration = 15; // default
        let condition = ""; // Nueva propiedad para describir la condición

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔍 ANALIZANDO LICENCIA:", license.Id || license.Equnr);
        console.log("   📋 Jobcond (Condición):", job, "=>", getJobCondName(job));
        console.log("   🏗️  Tipoequipo:", tipo);
        console.log("   ⚡ Patadic:", Patadic);
        console.log("   ⚡ Seccionadores de PaT Cerrados:", Intercerr);
        console.log("   🔌 Interruptores abiertos (Interabier):", interruptoresAbiertos);
        console.log("   🔩 Seccionadores abiertos (Seleccionad):", seccionadoresAbiertos);
        console.log("   🔒 Bloqueo recierre (Bloqueo):", bloqueoRecierre);

        if (job === "01") { // Consignación
            if (tipo === "L2" || tipo === "L5") {
                category = "ConsignacionLinea";
                duration = 45;
                condition = "Línea L2 o L5 (500kV/220kV)";
                console.log("   ✅ CATEGORÍA: Consignación de LÍNEA (L2 o L5) - 45 min");
            } else if (tiposLinea.includes(tipo)) {
                // 🆕 PARA L1, L3, L4, L6 - mostrar qué tiene
                category = "ConsignacionEquipo";
                duration = 30;

                const partes = [];
                if (Patadic && String(Patadic).trim() !== "") partes.push("PAT");
                if (Intercerr && String(Intercerr).trim() !== "") partes.push("PAT");
                if (interruptoresAbiertos && String(interruptoresAbiertos).trim() !== "") partes.push("Interruptores");
                if (seccionadoresAbiertos && String(seccionadoresAbiertos).trim() !== "") partes.push("Seccionadores");

                condition = partes.length > 0 ? partes.join(" + ") : `Línea ${tipo}`;
                console.log("   ✅ CATEGORÍA: Consignación de EQUIPO (L1/L3/L4/L6) - 30 min");
            } else {
                // 🆕 PARA OTROS EQUIPOS (TR, IN, etc.) - mostrar qué tiene
                category = "ConsignacionEquipo";
                duration = 30;

                const partes = [];
                if (Patadic && String(Patadic).trim() !== "") partes.push("PAT");
                if (Intercerr && String(Intercerr).trim() !== "") partes.push("PAT");
                if (interruptoresAbiertos && String(interruptoresAbiertos).trim() !== "") partes.push("Interruptores");
                if (seccionadoresAbiertos && String(seccionadoresAbiertos).trim() !== "") partes.push("Seccionadores");

                condition = partes.length > 0 ? partes.join(" + ") : `Tipo: ${tipo}`;
                console.log("   ✅ CATEGORÍA: Consignación de EQUIPO (Otro tipo) - 30 min");
            }
        } else if (job === "06") { // Condiciones Especiales 
            const patEstaVacio = !Patadic || String(Patadic).trim() === "" || !Intercerr || String(Intercerr).trim() === "";
            const tieneInterruptores = interruptoresAbiertos && String(interruptoresAbiertos).trim() !== "";
            const tieneSeccionadores = seccionadoresAbiertos && String(seccionadoresAbiertos).trim() !== "";

            console.log("   🔎 Verificando condiciones especiales:");
            console.log("      - PAT está vacío?", patEstaVacio);
            console.log("      - Tiene interruptores?", tieneInterruptores);
            console.log("      - Tiene seccionadores?", tieneSeccionadores);

            if (patEstaVacio && (tieneInterruptores || tieneSeccionadores)) {
                category = "ManiobrasSinConsignacion";
                duration = 20;
                const equipos = [];
                if (tieneInterruptores) equipos.push("Interruptores");
                if (tieneSeccionadores) equipos.push("Seccionadores");
                condition = `PAT vacío + ${equipos.join(" y ")}`;
                console.log("   ✅ CATEGORÍA: Maniobras SIN Consignación - 20 min");
            } else {
                category = "SinManiobras";
                duration = 10;
                condition = "Sin equipos de maniobra";
                console.log("   ✅ CATEGORÍA: SIN Maniobras - 10 min");
            }
        } else if (job === "04" || job === "05") {
            // 🔍 VERIFICAR SI TIENE BLOQUEO DE RECIERRE
            const tieneBloqueo = bloqueoRecierre && String(bloqueoRecierre).trim().toUpperCase() === "X";

            if (tieneBloqueo) {
                category = "TCTConBloqueo";
                duration = 15;
                condition = "Con bloqueo de recierre";
                console.log("   ✅ CATEGORÍA: TCT CON Bloqueo - 15 min");
            } else {
                category = "TCTSinBloqueo";
                duration = 15;
                condition = "Sin bloqueo de recierre";
                console.log("   ✅ CATEGORÍA: TCT SIN Bloqueo - 15 min");
            }
        } else {
            condition = "No clasificado";
            console.log("   ⚠️  CATEGORÍA: Otro (no clasificado)");
        }

        console.log("   🎯 RESULTADO FINAL: Categoría =", category, "| Duración =", duration, "min | Condición =", condition);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        return { category, duration, condition };
    }

    // 📝 Función auxiliar para mostrar el nombre legible de Jobcond
    function getJobCondName(job) {
        switch (job) {
            case '01': return 'Consignación';
            case '02': return 'Trabajo sin Tensión con PaT';
            case '03': return 'Trabajo con Tensión de Retorno';
            case '04': return 'Trabajo con Tensión (TcT)';
            case '05': return 'Trabajo Especiales (TcT)';
            case '06': return 'Condiciones Especiales';
            default: return job;
        }
    }

    return {

        // Exportamos para que TurnosService lo use en assignShiftsToLicences
        getShiftInfo: getShiftInfo,

        onCountItems: function (oView, data) {

            let consignacionLinea = 0;
            let consignacionEquipo = 0;
            let maniobrasSinConsignacion = 0;
            let sinManiobras = 0;
            let tctConBloqueo = 0;
            let tctSinBloqueo = 0;

            // 🆕 ARRAY PARA EL REPORTE
            let aReporteData = [];

            console.log("\n🔢 ════════════════════════════════════════════");
            console.log("📊 INICIANDO CONTEO DE ITEMS - Total licencias:", data?.length || 0);
            console.log("════════════════════════════════════════════\n");

            (data || []).forEach((item, index) => {
                console.log(`\n📌 Procesando licencia ${index + 1}/${data.length}`);
                const info = getShiftInfo(item);

                switch (info.category) {
                    case "ConsignacionLinea":
                        consignacionLinea++;
                        break;
                    case "ConsignacionEquipo":
                        consignacionEquipo++;
                        break;
                    case "ManiobrasSinConsignacion":
                        maniobrasSinConsignacion++;
                        break;
                    case "SinManiobras":
                        sinManiobras++;
                        break;
                    case "TCTConBloqueo":
                        tctConBloqueo++;
                        break;
                    case "TCTSinBloqueo":
                        tctSinBloqueo++;
                        break;
                }

                // 🆕 AGREGAR AL REPORTE SI TIENE MANIOBRAS
                const esConManiobras =
                    info.category === "ConsignacionLinea" ||
                    info.category === "ConsignacionEquipo" ||
                    info.category === "ManiobrasSinConsignacion";

                if (esConManiobras) {
                    console.log("      ✅ INCLUIDO en reporte de maniobras");

                    // Formatear hora
                    var sHora = "";
                    if (item.TurnoAsignado) {
                        sHora = item.TurnoAsignado;
                    } else if (item.Timbeg && item.Timbeg.ms) {
                        // Convertir de Edm.Time a HH:mm
                        const totalMinutes = Math.floor(item.Timbeg.ms / (1000 * 60));
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;
                        sHora = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
                    } else if (item.Gdate) {
                        let date = new Date(item.Gdate);
                        let hours = date.getHours().toString().padStart(2, '0');
                        let mins = date.getMinutes().toString().padStart(2, '0');
                        sHora = hours + ":" + mins;
                    }

                    // Formatear fecha
                    var sFecha = "";
                    if (item.Dateturno) {
                        var oDate = new Date(item.Dateturno);
                        var day = oDate.getDate().toString().padStart(2, '0');
                        var month = (oDate.getMonth() + 1).toString().padStart(2, '0');
                        var year = oDate.getFullYear();
                        sFecha = day + '/' + month + '/' + year;
                    }

                    // Tipo de intervención
                    var sTipoIntervencion = "";
                    switch (info.category) {
                        case "ConsignacionLinea":
                            sTipoIntervencion = "Consignación (Línea)";
                            break;
                        case "ConsignacionEquipo":
                            sTipoIntervencion = "Consignación (Equipo)";
                            break;
                        case "ManiobrasSinConsignacion":
                            sTipoIntervencion = "Condiciones especiales C/maniobra";
                            break;
                    }

                    aReporteData.push({
                        Fecha: sFecha,
                        IdLicencia: item.Id || "",
                        Equipo: item.Equnr || "",
                        Hora: sHora,
                        TipoIntervencion: sTipoIntervencion,
                        Condicion: info.condition,
                        Comentarios: item.Comentarios || ""
                    });
                }
            });

            const LTWithManouvers =
                consignacionLinea + consignacionEquipo + maniobrasSinConsignacion;

            const LTWithoutManouvers = sinManiobras;
            const TCT = tctConBloqueo + tctSinBloqueo;
            const totalCount = LTWithManouvers + LTWithoutManouvers + TCT;

            console.log("\n📊 ════════════════════════════════════════════");
            console.log("✅ RESUMEN FINAL DE CONTEO:");
            console.log("   🔵 Consignación Línea (L2/L5):", consignacionLinea);
            console.log("   🟢 Consignación Equipo:", consignacionEquipo);
            console.log("   🟡 Maniobras Sin Consignación:", maniobrasSinConsignacion);
            console.log("   🟠 Sin Maniobras:", sinManiobras);
            console.log("   🔴 TCT Con Bloqueo:", tctConBloqueo);
            console.log("   🟣 TCT Sin Bloqueo:", tctSinBloqueo);
            console.log("   ────────────────────────────");
            console.log("   📈 LT con maniobras:", LTWithManouvers);
            console.log("   📉 LT sin maniobras:", LTWithoutManouvers);
            console.log("   ⚡ Total TCT:", TCT);
            console.log("   🎯 TOTAL GENERAL:", totalCount);
            console.log("   📋 TOTAL EN REPORTE:", aReporteData.length);
            console.log("════════════════════════════════════════════\n");

            const counts = {
                ConsignacionLinea: consignacionLinea,
                ConsignacionEquipo: consignacionEquipo,
                ManiobrasSinConsignacion: maniobrasSinConsignacion,
                SinManiobras: sinManiobras,
                TCTConBloqueo: tctConBloqueo,
                TCTSinBloqueo: tctSinBloqueo,

                LTWithManouvers,
                LTWithoutManouvers,
                TCT,
                Total: totalCount
            };

            const oModel = new JSONModel(counts);
            oView.setModel(oModel, "countsModel");

            // 🆕 ORDENAR REPORTE POR HORA Y ACTUALIZAR MODELO
            aReporteData.sort(function (a, b) {
                if (!a.Hora) return 1;
                if (!b.Hora) return -1;
                return a.Hora.localeCompare(b.Hora);
            });

            const oReporteModel = new JSONModel(aReporteData);
            oView.setModel(oReporteModel, "ReporteModel");

            // 🆕 ACTUALIZAR RANGO DE FECHAS
            var sMinHora = "--";
            var sMaxHora = "--";
            var sFecha = "";

            if (aReporteData.length > 0) {
                var aHoras = aReporteData.filter(d => d.Hora).map(d => d.Hora);
                if (aHoras.length > 0) {
                    sMinHora = aHoras[0];
                    sMaxHora = aHoras[aHoras.length - 1];
                }
                sFecha = aReporteData[0].Fecha;
            }

            var oDateRangeControl = oView.byId ? oView.byId("reporteDateRange") : null;
            if (oDateRangeControl) {
                var sTexto = "Horarios de maniobras previstas desde: " + sFecha + " " + sMinHora + " Hasta: " + sFecha + " " + sMaxHora;
                oDateRangeControl.setText(sTexto);
            }

            return counts;
        }
    };
});