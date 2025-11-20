sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    return {
        formatDate: function (oDate) {
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy" // El formato que necesites
            });
            return oDateFormat.format(oDate);
        },
        getEstado: function (value) {
            switch (value) {
                case 'X':
                    return "F/S";
                case "":
                    return "E/S"
                default:
                    return value
            }
        }, 
        getJobCond: function (value) {
            switch (value) {
                case '01':
                    return 'Consignación';
                case '02':
                    return 'Trabajo sin Tensión con PaT';
                case '03':
                    return 'Trabajo con Tensión de Retorno';
                case '04':
                    return 'Trabajo con Tensión (TcT)';
                case '05':
                    return 'Trabajo Especiales (TcT)';
                case '06':
                    return 'Condiciones Especiales';
                default:
                    return value; // Devuelve el valor original si no coincide con ninguno de los casos
            }
        },
        getRegiones: function (value) {
            switch (value) {
                case '103':
                case '113':
                    return 'Norte';
                case '102':
                    return 'Reg. Metropolitana';
                case '104':
                case '114':
                    return 'Sur';
                default:
                    return value; // Devuelve el valor original si no coincide con ninguno de los casos
            }
        }, msTohoursSeconds: function (ms) {
            let date = new Date(ms);
            let hours = date.getHours().toString();
            hours = hours.length === 1 ? "0" + hours : hours;

            let minutes = date.getMinutes().toString();
            minutes = minutes.length === 1 ? "0" + minutes : minutes;
            return hours + ":" + minutes;
        }, turnoColor: function (consola) {
            switch (consola) {
                case "NOA":
                    return "Warning";
                case "NEA":
                    return "Information";
                case "METRO-SUR":
                    return "Success";
                default:
                    return "None";
            }
        },
        

    };
});
