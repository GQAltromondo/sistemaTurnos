// ============================================================
// TramitacionService.js - Servicio para manejar tramitaciones
// ============================================================

sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";

    return {
        /**
         * Obtiene las licencias con sus tramitaciones y fechas de calendario
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData
         * @param {Date} dFecha - Fecha seleccionada en el filtro
         * @returns {Promise} Promise con los datos de licencias y tramitaciones
         */
        getLicenciasConTramitacion: function (oModel, dFecha) {
            return new Promise((resolve, reject) => {
                const aFilters = [
                    new Filter("Dateturno", FilterOperator.EQ, dFecha),
                    new Filter("Empresa", FilterOperator.EQ, "100")
                ];

                const sExpand = "TramitacionesLicencia_nav/LicenciaEstadoDiarioSet";

                oModel.read("/LicenciaTrabajoSet", {
                    filters: aFilters,
                    urlParameters: {
                        "$expand": sExpand
                    },
                    success: (oData) => {
                        console.log("✓ Licencias con tramitación obtenidas:", oData.results.length);
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        console.error("❌ Error obteniendo licencias con tramitación:", oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Valida si una licencia tiene fechas en estado problemático
         * Estados problemáticos: AS (Anulada por solicitante), NA (No autorizada), CC (Condicionada)
         * @param {Object} oLicencia - Objeto de licencia con navegación de tramitaciones
         * @param {Date} dFechaSeleccionada - Fecha seleccionada por el usuario
         * @returns {Object} Objeto con información de validación
         */
        validarEstadoTramitacion: function (oLicencia, dFechaSeleccionada) {
            const oResultado = {
                tieneProblemas: false,
                colorIndicador: null, // "red" | "yellow" | null
                estadoEncontrado: null, // "AS" | "NA" | "CC" | null
                fechasProblematicas: []
            };

            // Verificar si tiene tramitaciones
            if (!oLicencia.TramitacionesLicencia_nav || !oLicencia.TramitacionesLicencia_nav.length) {
                return oResultado;
            }

            // Solo considerar tramitaciones con Estado "02" (Autorizado)
            const aTramitacionesAutorizadas = oLicencia.TramitacionesLicencia_nav.filter(t => t.Estado === "02");

            if (!aTramitacionesAutorizadas.length) {
                return oResultado;
            }

            // Convertir fecha seleccionada a string para comparar (formato: YYYY-MM-DD)
            const sFechaSeleccionada = this._formatDateForComparison(dFechaSeleccionada);

            // Recorrer tramitaciones autorizadas
            aTramitacionesAutorizadas.forEach(oTramitacion => {
                // Verificar si tiene fechas de calendario
                if (!oTramitacion.LicenciaEstadoDiarioSet || !oTramitacion.LicenciaEstadoDiarioSet.results) {
                    return;
                }

                // Recorrer fechas del calendario
                oTramitacion.LicenciaEstadoDiarioSet.results.forEach(oFecha => {
                    const sFechaCalendario = this._formatDateForComparison(oFecha.Fecha);

                    // Si la fecha coincide con la seleccionada
                    if (sFechaCalendario === sFechaSeleccionada) {
                        // Verificar estado problemático
                        if (oFecha.Estado === "AS" || oFecha.Estado === "NA") {
                            // Anulada por solicitante o No autorizada = ROJO
                            oResultado.tieneProblemas = true;
                            oResultado.colorIndicador = "red";
                            oResultado.estadoEncontrado = oFecha.Estado;
                            oResultado.fechasProblematicas.push({
                                fecha: oFecha.Fecha,
                                estado: oFecha.Estado,
                                observaciones: oFecha.Observaciones
                            });
                        } else if (oFecha.Estado === "CC") {
                            // Condicionada = AMARILLO (solo si no hay rojo)
                            if (!oResultado.tieneProblemas) {
                                oResultado.tieneProblemas = true;
                                oResultado.colorIndicador = "yellow";
                                oResultado.estadoEncontrado = oFecha.Estado;
                                oResultado.fechasProblematicas.push({
                                    fecha: oFecha.Fecha,
                                    estado: oFecha.Estado,
                                    observaciones: oFecha.Observaciones
                                });
                            }
                        }
                    }
                });
            });

            return oResultado;
        },

        /**
         * Procesa array de licencias y agrega información de validación
         * @param {Array} aLicencias - Array de licencias
         * @param {Date} dFechaSeleccionada - Fecha seleccionada
         * @returns {Array} Array de licencias con información de validación agregada
         */
        procesarLicenciasConValidacion: function (aLicencias, dFechaSeleccionada) {
            console.log("═══ Procesando licencias con validación de tramitación");
            console.log("→ Fecha seleccionada:", dFechaSeleccionada);
            console.log("→ Total licencias:", aLicencias.length);

            let iLicenciasConProblemas = 0;

            aLicencias.forEach(oLicencia => {
                const oValidacion = this.validarEstadoTramitacion(oLicencia, dFechaSeleccionada);
                
                // Agregar propiedades de validación a la licencia
                oLicencia.tramitacionProblematica = oValidacion.tieneProblemas;
                oLicencia.tramitacionColor = oValidacion.colorIndicador;
                oLicencia.tramitacionEstado = oValidacion.estadoEncontrado;
                oLicencia.tramitacionDetalles = oValidacion.fechasProblematicas;

                if (oValidacion.tieneProblemas) {
                    iLicenciasConProblemas++;
                    console.log(`⚠️ Licencia ${oLicencia.Id} tiene problemas:`, {
                        color: oValidacion.colorIndicador,
                        estado: oValidacion.estadoEncontrado
                    });
                }
            });

            console.log(`✓ Procesamiento completo: ${iLicenciasConProblemas} licencias con problemas`);
            return aLicencias;
        },

        /**
         * Formatea fecha para comparación (YYYY-MM-DD)
         * @param {Date|string} dDate - Fecha a formatear
         * @returns {string} Fecha en formato YYYY-MM-DD
         */
        _formatDateForComparison: function (dDate) {
            if (!dDate) return "";
            
            let oDate = dDate;
            if (typeof dDate === "string") {
                oDate = new Date(dDate);
            }

            const sYear = oDate.getFullYear();
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sDay = String(oDate.getDate()).padStart(2, "0");

            return `${sYear}-${sMonth}-${sDay}`;
        },

        /**
         * Obtiene descripción legible del estado
         * @param {string} sEstado - Código de estado (AS, NA, CC)
         * @returns {string} Descripción del estado
         */
        getEstadoDescripcion: function (sEstado) {
            const mEstados = {
                "AS": "Anulada por el solicitante",
                "NA": "No Autorizada",
                "CC": "Condicionada"
            };
            return mEstados[sEstado] || sEstado;
        }
    };
});
