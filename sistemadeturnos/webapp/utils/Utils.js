sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    const tiposLinea = ["L1", "L2", "L3", "L4", "L5", "L6"];

    // 🔹 Regla única de negocio: categoría + duración según licencia
    function getShiftInfo(license) {
        const job = license.Jobcond;
        const tipo = license.Tipoequipo;
        const patAdic = license.PatAdic;

        let category = "Otro";
        let duration = 15; // default

        if (job === "01") { // Consignación
            // FIX: Solo L2 y L5 son líneas de alta tensión (500kV y 220kV) = 45 min
            // El resto (L1, L3, L4, L6) son consignación de equipo = 30 min
            if (tipo === "L2" || tipo === "L5") {
                category = "ConsignacionLinea";   // Líneas 500kV y 220kV
                duration = 45;
            } else if (tiposLinea.includes(tipo)) {
                // L1, L3, L4, L6 son consignación de equipo
                category = "ConsignacionEquipo";
                duration = 30;
            } else {
                // Otros tipos de equipo también son consignación de equipo
                category = "ConsignacionEquipo";
                duration = 30;
            }
        } else if (job === "06") {
            const hasPatAdic = patAdic != null && String(patAdic).trim() !== "";
            if (hasPatAdic) {
                // FIX: Maniobras sin consignación = 20 minutos (antes era 20, está bien)
                category = "ManiobrasSinConsignacion";
                duration = 20;
            } else {
                category = "SinManiobras";
                duration = 10;
            }
        } else if (job === "04" || job === "05") {
            category = "TCT";
            duration = 15;
        }

        return { category, duration };
    }

    return {

        // Exportamos para que TurnosService lo use en assignShiftsToLicences
        getShiftInfo: getShiftInfo,

        onCountItems: function (oView, data) {

            let consignacionLinea = 0;
            let consignacionEquipo = 0;
            let maniobrasSinConsignacion = 0;
            let sinManiobras = 0;
            let countTCT = 0;

            (data || []).forEach(item => {
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
                    case "TCT":
                        countTCT++;
                        break;
                    // "Otro" no suma en estos KPIs
                }
            });

            const LTWithManouvers =
                consignacionLinea + consignacionEquipo + maniobrasSinConsignacion;

            const LTWithoutManouvers = sinManiobras;
            const TCT = countTCT;
            const totalCount = LTWithManouvers + LTWithoutManouvers + TCT;

            const counts = {
                ConsignacionLinea: consignacionLinea,
                ConsignacionEquipo: consignacionEquipo,
                ManiobrasSinConsignacion: maniobrasSinConsignacion,
                SinManiobras: sinManiobras,

                LTWithManouvers,
                LTWithoutManouvers,
                TCT,
                Total: totalCount
            };

            const oModel = new JSONModel(counts);
            oView.setModel(oModel, "countsModel");

            return counts;
        }
    };
});
