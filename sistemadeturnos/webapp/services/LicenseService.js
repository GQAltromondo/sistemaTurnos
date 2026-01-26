// LicenseService-dbg.js
sap.ui.define([], function () {
    "use strict";

    return {
        _expandProperties: "HorariosPorLicencia_nav,CoordinacionesLicencia_nav,ObservacionesLicencia_nav,TramitacionesLicencia_nav," +
            "SuspensionLicencia_nav,ReanudacionLicencia_nav,TransferenciaJefeTrabajo_nav,DevolucionLicencia_nav,EntregasLicencia_nav,AttachmentXLicencia_nav,EsquemaUnifilar_nav,TurnosLicencias_nav",
        FIND: function (license, oModel) {
            return new Promise((resolve, reject) => {
                var entity = "/LicenciaTrabajoSet";
                var key = entity +
                    "(Empresa='" + license.Empresa +
                    "',Id='" + license.Id +
                    "',Tipo='" + license.Tipo +
                    "',Anio='" + license.Anio + "')";

                let urlParameters = {};
                if (license.Tipo === "L") {
                    urlParameters.$expand = this._expandProperties;
                } else {
                    urlParameters.$expand = "HorariosPorLicencia_nav,CoordinacionesLicencia_nav,ObservacionesLicencia_nav,TurnosLicencias_nav";
                }

                oModel.read(key, {
                    urlParameters: urlParameters,
                    success: function (data) {

                        resolve(data);
                    },
                    error: function (error) {
                        console.error("FIND Error:", error);
                        reject(error);
                    }
                });
            });
        }, getSelectionArea: function (Tipo, sLicstat) {
            var sVal = "";
            if (Tipo === "S") {
                if (sLicstat === "09") {
                    sVal = "COORD"
                }
            } else {
                // Issue 514 - Para los status 09 y 02 se deben enviar a ambos tecnico y coord
                //				if (sLicstat === "09" || sLicstat === "02")
                //				sVal = "COORD"
                //		}
                // Issue 514 - Se agregaron nuevos status a la condicion
                if (sLicstat === "01" || sLicstat === "11" || sLicstat === "07" || sLicstat === "06" || sLicstat === "04" || sLicstat === "03") {
                    sVal = "TECNICO"
                }
            }
            return sVal;
        },

    };
});
