sap.ui.define([
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/Utils",
], function (MessageBox, Filter, FilterOperator, ModelHelper, Utils) {
    "use strict";

    return {

        search: function ({ FechaTurno, oView, isRefresh = false }) {
            var aFilters = [];

            const Fecha = FechaTurno.toISOString().split('T')[0];

            aFilters.push(new Filter({
                path: "Solbeg",
                operator: FilterOperator.LE,
                value1: FechaTurno
            }));

            aFilters.push(new Filter({
                path: "Solend",
                operator: FilterOperator.GE,
                value1: FechaTurno
            }));


            aFilters.push(new Filter({
                path: "Empresa",
                operator: FilterOperator.EQ,
                value1: 100
            }));

            aFilters.push(new Filter({
                path: "Tipo",
                operator: FilterOperator.EQ,
                value1: "L"
            }));

            const oDataModel = oView.getModel();
            return new Promise((resolve, reject) => {

                oDataModel.read('/LicenciaTrabajoSet', {
                    filters: aFilters,
                    success: (data) => {

                        const datosFiltrados = this.filtrarFechasTipo(
                            data.results,
                            Fecha,
                            isRefresh
                        );

                        let resultadoFinal = datosFiltrados;

                        if (datosFiltrados.length > 0) {
                            resultadoFinal = this.encontrarGrupo(
                                this.ordenarPorEqunr(datosFiltrados),
                                oView
                            );
                            this.assignShiftsToLicences(resultadoFinal, oView);
                        }

                        resolve(resultadoFinal);
                    },
                    error: (error) => {
                        MessageBox.show("No se encontraron datos en las fechas seleccionadas", {
                            icon: MessageBox.Icon.WARNING,
                            title: "Alerta"
                        });
                        reject(error);
                    }
                });
            });
        },

        filtrarFechasTipo: function (datos, fechaSeleccionada, isRefresh = false) {
            if (!Array.isArray(datos)) {
                throw new Error("El parámetro 'datos' debe ser un array.");
            }
            let estadosPermitidos = []
            if (typeof fechaSeleccionada !== "string") {
                throw new Error("El parámetro 'fechaSeleccionada' debe ser un string con formato de fecha (YYYY-MM-DD).");
            }
            if (isRefresh) {
                // 01 = Autorizada
                // 02 = Observada
                // 07 = Coordinada
                // 08 = Entregada
                // 09 = Generada
                // 10 = Suspendida
                // 23 = En Tramite

                estadosPermitidos = ["01", "02", "07", "08", "09", "10", "23"];
            } else {
                estadosPermitidos = ["01", "07", "08", "09", "10", "23"];
            }
            const datosFiltrados = datos.filter(dato => {
                // 1) Filtrar por estados permitidos
                if (!estadosPermitidos.includes(dato.Licstat)) {
                    return false;
                }

                // 2) Lógica según Period
                if (dato.Period === "D") {
                    // Diaria: si está en estado permitido, ya pasa
                    return true;
                }

                if (dato.Period === "C") {
                    // Continua:
                    // - si isRefresh = true → no validamos Solbeg, pasa directo
                    if (isRefresh) {
                        return true;
                    }

                    // - si isRefresh = false → Solbeg debe ser igual a fechaSeleccionada
                    const fechaSolbeg = dato.Solbeg instanceof Date ? dato.Solbeg : new Date(dato.Solbeg);
                    if (isNaN(fechaSolbeg)) return false;

                    const isoSolbeg = fechaSolbeg.toISOString().split("T")[0]; // YYYY-MM-DD
                    return isoSolbeg === fechaSeleccionada;
                }

                // Otros Period no pasan
                return false;
            });

            return datosFiltrados;
        },

        encontrarGrupo: function (licencias, oView) {

            const consolasModel = ModelHelper.getModel("consolasModel", oView).getData();

            if (!consolasModel || typeof consolasModel !== "object") {
                return "Modelo no encontrado o no es válido";
            }

            licencias.forEach((licencia) => {
                for (const grupo in consolasModel) {
                    const consolas = consolasModel[grupo];

                    if (Array.isArray(consolas)) {
                        const consolaEncontrada = consolas.find((consola) => consola === licencia.Tplnr);

                        if (consolaEncontrada) {
                            licencia.Consola = grupo;
                        }
                    } else {
                        console.warn(`El grupo '${grupo}' no es un array. Se ignorará.`);
                    }
                }
            });
            licencias.sort((a, b) => {
                if (a.Consola < b.Consola) return -1;
                if (a.Consola > b.Consola) return 1;
                return 0;
            });

            return licencias;
        }, ordenarPorEqunr: function (data) {
            // Ordenar los elementos por el campo 'Equnr'
            data.sort((a, b) => {
                if (a.Equnr === b.Equnr) {
                    // Si las consolas son iguales, no cambiar el orden
                    return 0;
                }
                return a.Equnr < b.Equnr ? -1 : 1;
            });
            return data;
        },
        assignShiftsToLicences: function (licences, oView) {
            // Fecha seleccionada en el DatePicker
            const selectedDate = oView.byId("date").getDateValue(); // Date

            // Función para comparar solo año/mes/día
            const isSameDay = (d1, d2) => {
                if (!(d1 instanceof Date) || !(d2 instanceof Date)) {
                    return false;
                }
                return d1.getFullYear() === d2.getFullYear() &&
                    d1.getMonth() === d2.getMonth() &&
                    d1.getDate() === d2.getDate();
            };

            licences.forEach((license) => {
                // Por las dudas, limpiamos primero
                license.TurnoAsignado = null;
                license.Comentarios = null;

                const navResults = license.TurnosLicencias_nav?.results;
                if (!Array.isArray(navResults) || navResults.length === 0) {
                    return; // no tiene turnos en backend, nada que hacer
                }

                // Buscar el registro cuyo Dateturno coincida con el día seleccionado
                const match = navResults.find((r) => {
                    // Ajustá el nombre del campo si en el nav se llama distinto
                    const navDate = r.Dateturno || r.DateTurno;
                    return isSameDay(navDate, selectedDate);
                });

                if (match) {
                    // Usamos el turno y los comentarios del backend para ese día
                    license.TurnoAsignado = match.Turno;
                    license.Comentarios = match.Comentarios;
                }
            });

            // Si querés, podés ordenar las licencias por TurnoAsignado:
            licences.sort((a, b) => {
                const ta = a.TurnoAsignado || "";
                const tb = b.TurnoAsignado || "";
                return ta.localeCompare(tb);
            });
        },


        _formatTime: function (iMinutes) {
            // Convertir los minutos de nuevo a formato HH:mm
            var iHours = Math.floor(iMinutes / 60);
            var iRemainderMinutes = iMinutes % 60;

            // Asegurarse de que siempre tenga 2 dígitos
            return (iHours < 10 ? "0" : "") + iHours + ":" + (iRemainderMinutes < 10 ? "0" : "") + iRemainderMinutes;
        },
        _convertTimeToMinutes: function (timeString) {
            if (!timeString) return 0;
            let [hours, minutes] = timeString.split(":").map(Number);
            return hours * 60 + minutes;
        },
        appendLicencesToModel: function (licencesToAdd, oView) {
            const aNewLicences = Array.isArray(licencesToAdd) ? licencesToAdd : [licencesToAdd];
            if (!aNewLicences.length) return;

            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const aCurrent = oLicencesModel.getData() || [];

            const existingIds = new Set(aCurrent.map(l => l.Id));

            const aToInsert = aNewLicences
                .filter(l => !existingIds.has(l.Id))
                .map(l => {
                    const copia = { ...l };

                    // ❗ SIN turno asignado
                    delete copia.TurnoAsignado;

                    // ❗ GRUPO DESACOPLADO (clave!)
                    copia.Grupo = `_Desacoplado_${copia.Id}`;

                    return copia;
                });

            aToInsert.forEach(lic => {
                const consola = lic.Consola || "";

                let insertIndex = -1;
                for (let i = aCurrent.length - 1; i >= 0; i--) {
                    if (aCurrent[i].Consola === consola) {
                        insertIndex = i + 1;
                        break;
                    }
                }

                if (insertIndex === -1) {
                    aCurrent.push(lic);
                } else {
                    aCurrent.splice(insertIndex, 0, lic);
                }
            });
            Utils.onCountItems(oView, aCurrent)
            oLicencesModel.setData(aCurrent);

            oLicencesModel.refresh(true);
        },





    };
});
