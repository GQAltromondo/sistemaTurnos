sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    const tiposLinea = ["L1", "L2", "L3", "L4", "L5", "L6"];

    return {

        onCountItems: function (oView, data) {

            let consignacionLinea = 0;
            let consignacionEquipo = 0;
            let maniobrasSinConsignacion = 0;
            let sinManiobras = 0;
            let countTCT = 0;

            data.forEach(item => {
                const job = item.Jobcond;
                const tipo = item.Tipoequipo;
                const patAdic = item.PatAdic;

                switch (job) {
                    case "01": // Consignación
                        if (tiposLinea.includes(tipo)) {
                            consignacionLinea++;
                        } else {
                            consignacionEquipo++;
                        }
                        break;

                    case "06": // Maniobras o Sin Maniobras
                        if (patAdic != null && String(patAdic).trim() !== "") {
                            maniobrasSinConsignacion++;
                        } else {
                            sinManiobras++;
                        }
                        break;

                    case "04":
                    case "05": // TCT
                        countTCT++;
                        break;
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

            // Setear modelo countsModel en la vista
            const oModel = new JSONModel(counts);
            oView.setModel(oModel, "countsModel");

            return counts;
        }
    };
});
