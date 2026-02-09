sap.ui.define([], function () {
    "use strict";

    return {
        formatDateYYYYMMDD: function (date) {
            if (!date) return "";

            let oDate;

            if (date instanceof Date) {
                oDate = date;
            }
            else if (typeof date === "string" && !date.startsWith("/Date(")) {
                oDate = new Date(date);
            }
            else if (typeof date === "string" && date.startsWith("/Date(")) {
                const timestamp = parseInt(date.match(/\d+/)[0]);
                oDate = new Date(timestamp);
            }
            else if (typeof date === "object" && date.__edmType === "Edm.DateTime") {
                oDate = new Date(date);
            }
            else {
                try {
                    oDate = new Date(date);
                } catch (e) {
                    return "";
                }
            }

            if (isNaN(oDate.getTime())) {
                return "";
            }

            const year = oDate.getFullYear();
            const month = String(oDate.getMonth() + 1).padStart(2, "0");
            const day = String(oDate.getDate()).padStart(2, "0");

            return `${year}-${month}-${day}`;
        },

        generateDateRange: function (oFechaInicio, oFechaFin) {
            const aFechas = [];
            
            const oFechaInicioUTC = new Date(Date.UTC(
                oFechaInicio.getFullYear(),
                oFechaInicio.getMonth(),
                oFechaInicio.getDate(),
                0, 0, 0, 0
            ));
            
            const oFechaFinUTC = new Date(Date.UTC(
                oFechaFin.getFullYear(),
                oFechaFin.getMonth(),
                oFechaFin.getDate(),
                0, 0, 0, 0
            ));
            
            const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
            oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

            const oFechaActualUTC = new Date(oFechaInicioUTC);
            while (oFechaActualUTC < oFechaFinLimiteUTC) {
                const oFechaNormalizada = new Date(Date.UTC(
                    oFechaActualUTC.getUTCFullYear(),
                    oFechaActualUTC.getUTCMonth(),
                    oFechaActualUTC.getUTCDate(),
                    0, 0, 0, 0
                ));
                aFechas.push(oFechaNormalizada);
                oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
            }

            return aFechas;
        },

        normalizeToUTC: function (oFecha) {
            return new Date(Date.UTC(
                oFecha.getFullYear(),
                oFecha.getMonth(),
                oFecha.getDate(),
                0, 0, 0, 0
            ));
        },

        isSameDay: function (oFecha1, oFecha2) {
            const oFecha1Normalizada = this.normalizeToUTC(oFecha1);
            const oFecha2Normalizada = this.normalizeToUTC(oFecha2);
            return oFecha1Normalizada.getTime() === oFecha2Normalizada.getTime();
        }
    };
});
