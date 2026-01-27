sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    return {
        /**
         * Envía un email para una licencia usando workflow
         * @param {Object} oLicencia - Datos de la licencia
         * @param {Object} oComponent - Componente de la aplicación
         * @param {String} [csrfToken] - Token CSRF opcional. Si no se proporciona, se obtiene automáticamente
         * @returns {Promise} Promise que se resuelve cuando el mail se envía correctamente
         */
        sendLicenseEmail: function (oLicencia, oComponent, csrfToken) {
            if (!oLicencia || !oComponent) {
                return Promise.reject(new Error("Datos de licencia o componente faltantes"));
            }

            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            // Si ya tenemos el token, usarlo directamente. Si no, obtenerlo
            const tokenPromise = csrfToken 
                ? Promise.resolve(csrfToken)
                : this._fetchCSRFToken(sBaseURL);

            return tokenPromise.then((token) => {
                const sPostURL = sBaseURL + "/workflow-instances";
                const asunto = "Turno de maniobra - COT | " + oLicencia.Equnr + " " + oLicencia.Equstat + " Licencia: " + oLicencia.Id + " / " + oLicencia.Anio
                const context = {
                    Asunto: asunto,
                    society: oLicencia.society,
                    Destinatario: oLicencia.Destinatario || oLicencia.Email || "",
                    IdLicencia: oLicencia.Id || "",
                    Equipo: oLicencia.Equnr || "",
                    EstadoEquipo: oLicencia.Equstat || "",
                    CondTrabajo: oLicencia.Jobcond || "",
                    Fecha: oLicencia.Fecha,
                    Turno: oLicencia.Turno || oLicencia.TurnoAsignado || "",
                    Comentarios: oLicencia.Comments || "",
                    DescripcionEquipo: oLicencia.DescEquipo || "",
                    Consola: oLicencia.Consola || "",
                    Period: oLicencia.Period
                };

                const data = {
                    definitionId: "transener.wfturnos",
                    context: context
                };

                return new Promise((resolve, reject) => {
                    jQuery.ajax({
                        url: sPostURL,
                        method: "POST",
                        contentType: "application/json",
                        timeout: 60000,
                        headers: {
                            "X-CSRF-Token": token
                        },
                        data: JSON.stringify(data),
                        success: function (result) {
                            resolve(result);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            let errorMessage = "Error al enviar mail";
                            if (jqXHR && jqXHR.responseText) {
                                try {
                                    const errorResponse = JSON.parse(jqXHR.responseText);
                                    errorMessage = errorResponse.error?.message ||
                                        errorResponse.message ||
                                        errorMessage;
                                } catch (e) {
                                    errorMessage = errorThrown || textStatus || errorMessage;
                                }
                            }
                            reject(new Error(errorMessage));
                        }
                    });
                });
            });
        },

        /**
         * Envía múltiples emails reutilizando el mismo token CSRF
         * Obtiene el token una sola vez y lo reutiliza para todos los envíos
         * @param {Array} aLicencias - Array de objetos con datos de licencias
         * @param {Object} oComponent - Componente de la aplicación
         * @returns {Promise<Array>} Promise que se resuelve con un array de resultados {success: boolean, licenciaId: string, result?: Object, error?: Error}
         */
        sendMultipleLicenseEmails: function (aLicencias, oComponent) {
            if (!aLicencias || !Array.isArray(aLicencias) || aLicencias.length === 0) {
                return Promise.reject(new Error("Se requiere un array de licencias válido"));
            }

            if (!oComponent) {
                return Promise.reject(new Error("Componente faltante"));
            }

            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            // Obtener el token CSRF una sola vez
            return this._fetchCSRFToken(sBaseURL)
                .then((csrfToken) => {
                    console.log("✅ Token CSRF obtenido, reutilizando para", aLicencias.length, "envíos");

                    // Enviar todos los mails usando el mismo token
                    const aPromises = aLicencias.map((oLicencia) => {
                        return this.sendLicenseEmail(oLicencia, oComponent, csrfToken)
                            .then((result) => {
                                return {
                                    success: true,
                                    licenciaId: oLicencia.Id || "N/A",
                                    result: result
                                };
                            })
                            .catch((error) => {
                                return {
                                    success: false,
                                    licenciaId: oLicencia.Id || "N/A",
                                    error: error
                                };
                            });
                    });

                    return Promise.all(aPromises);
                });
        },

        getWorkflowRuntimeBaseURL: function (oComponent) {
            return this._getWorkflowRuntimeBaseURL(oComponent);
        },

        getCSRFToken: function (oComponent) {
            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);
            return this._fetchCSRFToken(sBaseURL);
        },

        _getWorkflowRuntimeBaseURL: function (oComponent) {
            const appId = oComponent.getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            let appModulePath = jQuery.sap.getModulePath(appPath);

            const uuidWithDotPattern = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([^\/]+.*)/;
            const match = appModulePath.match(uuidWithDotPattern);

            if (match && match[2]) {
                appModulePath = "/" + match[2];
            } else {
                const currentPath = window.location.pathname;
                const pathMatch = currentPath.match(/\/(?:[0-9a-f-]+\.)?([^\/]+.*)/);
                if (pathMatch && pathMatch[1]) {
                    appModulePath = "/" + pathMatch[1];
                }
            }

            if (!appModulePath.startsWith("/")) {
                appModulePath = "/" + appModulePath;
            }

            return appModulePath + "/bpmworkflowruntime/v1";
        },

        _fetchCSRFToken: function (sBaseURL) {
            const sURL = sBaseURL + "/xsrf-token";

            return new Promise((resolve, reject) => {
                jQuery.ajax({
                    url: sURL,
                    method: "GET",
                    timeout: 30000,
                    headers: {
                        "X-CSRF-Token": "Fetch"
                    },
                    success: function (data, textStatus, jqXHR) {
                        const csrfToken = jqXHR.getResponseHeader("X-CSRF-Token");
                        if (csrfToken) {
                            resolve(csrfToken);
                        } else {
                            reject(new Error("No se pudo obtener el token CSRF"));
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        reject(new Error("Error al obtener token CSRF: " + (errorThrown || textStatus)));
                    }
                });
            });
        }
    };
});
