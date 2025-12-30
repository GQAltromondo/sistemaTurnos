sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    const FormatHelper = {
        formatDate: function (oDate) {
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy"
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
                    return value;
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
                    return value;
            }
        },
        
        msTohoursSeconds: function (ms) {
            let date = new Date(ms);
            let hours = date.getHours().toString().padStart(2, '0');
            let minutes = date.getMinutes().toString().padStart(2, '0');
            return hours + ":" + minutes;
        },
        
        turnoColor: function (consola) {
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
   
        edmTimeToHHMM: function (edmTime) {
            console.log("🕐 edmTimeToHHMM - Input:", edmTime, "Tipo:", typeof edmTime);
            
            let milliseconds = edmTime;
            if (typeof edmTime === 'object' && edmTime !== null && 'ms' in edmTime) {
                milliseconds = edmTime.ms;
            }
            
            // Convertir milisegundos a horas y minutos
            const totalMinutes = Math.floor(milliseconds / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            
            const result = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
            
            return result;
        },
        
        durationToTime: function (duration) {
            if (!duration || typeof duration !== 'string') {
                return "";
            }
            
            const hoursMatch = duration.match(/(\d+)H/);
            const minutesMatch = duration.match(/(\d+)M/);
            
            const hours = hoursMatch ? hoursMatch[1].padStart(2, '0') : '00';
            const minutes = minutesMatch ? minutesMatch[1].padStart(2, '0') : '00';
            
            const result = hours + ":" + minutes;
            
            return result;
        },
    
        formatInitHour: function (timbeg, gdate) {
            
            if (timbeg && typeof timbeg === 'object' && 'ms' in timbeg) {
                return FormatHelper.edmTimeToHHMM(timbeg);
            }
            
            if (timbeg && typeof timbeg === 'string' && timbeg !== "PT00H00M00S") {
                return FormatHelper.durationToTime(timbeg);
            }
            
            if (gdate) {
                return FormatHelper.msTohoursSeconds(gdate);
            }
            
            console.log("❌ Sin datos de hora válidos");
            return "";
        }
    };

    return FormatHelper;
});