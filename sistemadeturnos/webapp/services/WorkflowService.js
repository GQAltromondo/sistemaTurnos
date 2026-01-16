/**
 * Servicio para invocar workflows de SAP Process Automation
 */
sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    return {
        /**
         * Obtiene la URL base del workflow runtime
         * @param {sap.ui.core.Component} oComponent - Componente de la aplicación
         * @returns {string} URL base del workflow runtime
         */
        _getWorkflowRuntimeBaseURL: function (oComponent) {
            // Obtener el appModulePath usando jQuery.sap.getModulePath()
            const appId = oComponent.getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            let appModulePath = jQuery.sap.getModulePath(appPath);
            
            // appModulePath puede tener dos formatos:
            // 1. "/9037bef4-50f6-4f4f-9972-81ee1455e041.sistemaTurnos.transenersistemadeturnos/~41b5087d-0582-4b60-9e92-d931c4311573~"
            // 2. "/sistemaTurnos.transenersistemadeturnos/~41b5087d-0582-4b60-9e92-d931c4311573~"
            // Necesitamos extraer: "/sistemaTurnos.transenersistemadeturnos/~41b5087d-0582-4b60-9e92-d931c4311573~"
            
            // Buscar el patrón: /UUID.nombreApp (UUID tiene formato con guiones)
            // Patrón UUID: 8-4-4-4-12 caracteres hexadecimales
            const uuidWithDotPattern = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([^\/]+.*)/;
            const match = appModulePath.match(uuidWithDotPattern);
            
            if (match && match[2]) {
                // Caso 1: Tiene prefijo UUID, extraer solo la parte después del punto
                appModulePath = "/" + match[2];
            } else {
                // Caso 2: No tiene prefijo UUID, usar window.location.pathname como fallback
                const currentPath = window.location.pathname;
                // Buscar el patrón similar en la URL actual
                const pathMatch = currentPath.match(/\/(?:[0-9a-f-]+\.)?([^\/]+.*)/);
                if (pathMatch && pathMatch[1]) {
                    appModulePath = "/" + pathMatch[1];
                }
                // Si no se encuentra, usar appModulePath tal cual (ya debería estar correcto)
            }
            
            // Asegurar que comience con /
            if (!appModulePath.startsWith("/")) {
                appModulePath = "/" + appModulePath;
            }
            
            return appModulePath + "/bpmworkflowruntime/v1";
        },

        /**
         * Obtiene el token CSRF necesario para operaciones POST/PUT/DELETE
         * @param {string} sBaseURL - URL base del workflow runtime
         * @returns {Promise<string>} Token CSRF
         */
        _fetchCSRFToken: function (sBaseURL) {
            const sURL = sBaseURL + "/xsrf-token";
            
            return new Promise((resolve, reject) => {
                try {
                    console.log("🔍 [WorkflowService] Intentando obtener CSRF token desde:", sURL);
                    
                    jQuery.ajax({
                        url: sURL,
                        method: "GET",
                        timeout: 30000, // 30 segundos timeout
                        headers: {
                            "X-CSRF-Token": "Fetch"
                        },
                        success: function (data, textStatus, jqXHR) {
                            try {
                                console.log("✅ [WorkflowService] Respuesta recibida:", {
                                    status: jqXHR.status,
                                    statusText: jqXHR.statusText
                                });
                                
                                const csrfToken = jqXHR.getResponseHeader("X-CSRF-Token");
                                if (csrfToken) {
                                    console.log("✅ [WorkflowService] Token CSRF obtenido exitosamente");
                                    resolve(csrfToken);
                                } else {
                                    // Token no viene en el header
                                    const error = new Error("No se pudo obtener el token CSRF del header de respuesta");
                                    error.details = {
                                        status: jqXHR ? jqXHR.status : "unknown",
                                        statusText: jqXHR ? jqXHR.statusText : "unknown",
                                        responseText: jqXHR ? jqXHR.responseText : "unknown",
                                        url: sURL,
                                        allHeaders: jqXHR ? jqXHR.getAllResponseHeaders() : "N/A"
                                    };
                                    console.error("❌ [WorkflowService] Token CSRF no encontrado en el header", error.details);
                                    reject(error);
                                }
                            } catch (e) {
                                console.error("❌ [WorkflowService] Error al procesar respuesta:", e);
                                reject(new Error("Error al procesar respuesta del servidor: " + e.message));
                            }
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            // Manejo robusto de errores
                            let status = 0;
                            let statusText = "Unknown";
                            let responseText = "";
                            
                            if (jqXHR) {
                                status = jqXHR.status || 0;
                                statusText = jqXHR.statusText || "Unknown";
                                try {
                                    responseText = jqXHR.responseText || "";
                                } catch (e) {
                                    responseText = "Error al leer responseText: " + e.message;
                                }
                            }
                            
                            // Error detallado para diagnóstico
                            const error = new Error("Error al obtener token CSRF: " + (errorThrown || textStatus || "Error desconocido"));
                            error.details = {
                                status: status,
                                statusText: statusText,
                                textStatus: textStatus,
                                errorThrown: errorThrown,
                                responseText: responseText,
                                url: sURL,
                                possibleCauses: this._diagnoseCSRFError(status)
                            };
                            
                            console.error("❌ [WorkflowService] Error al obtener token CSRF:", error.details);
                            
                            // Si es un error de red (status 0), agregar más información
                            if (status === 0) {
                                error.details.networkError = true;
                                error.details.message = "Error de red. Verifica la conectividad y la configuración de CORS.";
                            }
                            
                            reject(error);
                        }.bind(this),
                        complete: function (jqXHR, textStatus) {
                            // Log para debugging
                            if (textStatus !== "success") {
                                console.warn("⚠️ [WorkflowService] Petición completada con estado:", textStatus);
                            }
                        }
                    });
                } catch (e) {
                    // Capturar cualquier error de JavaScript antes de la petición
                    console.error("❌ [WorkflowService] Error al configurar petición AJAX:", e);
                    const error = new Error("Error al configurar la petición: " + e.message);
                    error.details = {
                        url: sURL,
                        error: e.toString(),
                        stack: e.stack
                    };
                    reject(error);
                }
            });
        },

        /**
         * Diagnostica posibles causas del error al obtener el token CSRF
         * @param {number} status - Código de estado HTTP
         * @returns {string[]} Array de posibles causas
         */
        _diagnoseCSRFError: function (status) {
            const causes = [];
            
            switch (status) {
                case 401:
                case 403:
                    causes.push("Problema de autenticación/autorización");
                    causes.push("El token OAuth2 puede haber expirado");
                    causes.push("Falta configuración de permisos XSUAA");
                    causes.push("El servicio de Process Automation no está accesible desde esta aplicación");
                    break;
                case 404:
                    causes.push("La ruta del workflow runtime no está configurada correctamente");
                    causes.push("El servicio de Process Automation no está desplegado");
                    causes.push("La ruta en xs-app.json puede estar incorrecta");
                    break;
                case 500:
                case 502:
                case 503:
                    causes.push("El servicio de Process Automation no está disponible");
                    causes.push("Problema temporal del servidor");
                    break;
                case 0:
                    causes.push("Error de red - CORS o conexión bloqueada");
                    causes.push("La URL base puede estar incorrecta");
                    causes.push("Problema de red o firewall");
                    break;
                default:
                    causes.push("Error desconocido - revisar logs del servidor");
            }
            
            return causes;
        },

        /**
         * Inicia una instancia del workflow
         * @param {object} oOptions - Opciones para iniciar el workflow
         * @param {string} oOptions.definitionId - ID del workflow (ej: "transener.wfturnos")
         * @param {object} oOptions.context - Contexto del workflow (debe incluir "Destinatario")
         * @param {sap.ui.core.Component} oOptions.oComponent - Componente de la aplicación
         * @param {function} oOptions.onSuccess - Callback de éxito
         * @param {function} oOptions.onError - Callback de error
         * @returns {Promise} Promesa que se resuelve cuando el workflow se inicia
         */
        startWorkflowInstance: function (oOptions) {
            const {
                definitionId = "transener.wfturnos",
                context = {},
                oComponent,
                onSuccess,
                onError
            } = oOptions;

            // Validar que el contexto tenga el destinatario
            if (!context.Destinatario) {
                const error = new Error("El contexto debe incluir el campo 'Destinatario'");
                if (onError) {
                    onError(error);
                } else {
                    MessageBox.error("Error: El contexto debe incluir el campo 'Destinatario'");
                }
                return Promise.reject(error);
            }

            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            return this._fetchCSRFToken(sBaseURL)
                .then((csrfToken) => {
                    const sPostURL = sBaseURL + "/workflow-instances";
                    
                    return new Promise((resolve, reject) => {
                        try {
                            const data = {
                                definitionId: definitionId,
                                context: context
                            };

                            console.log("🔍 [WorkflowService] Iniciando workflow:", {
                                definitionId: definitionId,
                                url: sPostURL
                            });

                            jQuery.ajax({
                                url: sPostURL,
                                method: "POST",
                                contentType: "application/json",
                                timeout: 60000, // 60 segundos timeout
                                headers: {
                                    "X-CSRF-Token": csrfToken
                                },
                                data: JSON.stringify(data),
                                success: function (result, textStatus, jqXHR) {
                                    try {
                                        console.log("✅ [WorkflowService] Workflow iniciado exitosamente:", result);
                                        if (onSuccess) {
                                            onSuccess(result);
                                        } else {
                                            MessageToast.show("Workflow iniciado correctamente");
                                        }
                                        resolve(result);
                                    } catch (e) {
                                        console.error("❌ [WorkflowService] Error al procesar respuesta exitosa:", e);
                                        reject(new Error("Error al procesar respuesta: " + e.message));
                                    }
                                },
                                error: function (jqXHR, textStatus, errorThrown) {
                                    // Manejo robusto de errores
                                    let status = 0;
                                    let statusText = "Unknown";
                                    let responseText = "";
                                    let errorMessage = "Error al iniciar el workflow";
                                    
                                    if (jqXHR) {
                                        status = jqXHR.status || 0;
                                        statusText = jqXHR.statusText || "Unknown";
                                        
                                        try {
                                            responseText = jqXHR.responseText || "";
                                            if (responseText) {
                                                try {
                                                    const errorResponse = JSON.parse(responseText);
                                                    errorMessage = errorResponse.error?.message || 
                                                                   errorResponse.message || 
                                                                   errorMessage;
                                                } catch (e) {
                                                    // Si no es JSON, usar el texto directamente
                                                    errorMessage = responseText.length > 200 
                                                        ? responseText.substring(0, 200) + "..." 
                                                        : responseText;
                                                }
                                            }
                                        } catch (e) {
                                            responseText = "Error al leer responseText: " + e.message;
                                        }
                                    }

                                    console.error("❌ [WorkflowService] Error al iniciar workflow:", {
                                        status: status,
                                        statusText: statusText,
                                        textStatus: textStatus,
                                        errorThrown: errorThrown,
                                        responseText: responseText,
                                        url: sPostURL
                                    });

                                    const error = new Error(errorMessage);
                                    error.details = {
                                        status: status,
                                        statusText: statusText,
                                        textStatus: textStatus,
                                        errorThrown: errorThrown,
                                        responseText: responseText,
                                        url: sPostURL
                                    };
                                    
                                    if (onError) {
                                        onError(error, jqXHR);
                                    } else {
                                        MessageBox.error(errorMessage);
                                    }
                                    reject(error);
                                },
                                complete: function (jqXHR, textStatus) {
                                    if (textStatus !== "success") {
                                        console.warn("⚠️ [WorkflowService] Petición POST completada con estado:", textStatus);
                                    }
                                }
                            });
                        } catch (e) {
                            // Capturar cualquier error de JavaScript antes de la petición
                            console.error("❌ [WorkflowService] Error al configurar petición POST:", e);
                            const error = new Error("Error al configurar la petición: " + e.message);
                            error.details = {
                                url: sPostURL,
                                error: e.toString(),
                                stack: e.stack
                            };
                            
                            if (onError) {
                                onError(error);
                            } else {
                                MessageBox.error("Error: " + e.message);
                            }
                            reject(error);
                        }
                    });
                })
                .catch((error) => {
                    // Error mejorado con detalles de diagnóstico
                    let errorMessage = error.message || "Error desconocido";
                    let errorDetails = "";
                    
                    // Construir mensaje detallado
                    if (error.details) {
                        // Agregar código HTTP si existe
                        if (error.details.status !== undefined) {
                            errorDetails += `\n\nCódigo HTTP: ${error.details.status}`;
                            if (error.details.statusText) {
                                errorDetails += ` (${error.details.statusText})`;
                            }
                        }
                        
                        // Agregar URL si existe
                        if (error.details.url) {
                            errorDetails += `\n\nURL intentada: ${error.details.url}`;
                        }
                        
                        // Agregar posibles causas
                        if (error.details.possibleCauses && error.details.possibleCauses.length > 0) {
                            errorDetails += "\n\nPosibles causas:\n• " + 
                                error.details.possibleCauses.join("\n• ");
                        }
                        
                        // Agregar información de error de red
                        if (error.details.networkError) {
                            errorDetails += "\n\n⚠️ Error de red detectado. Verifica la conectividad.";
                        }
                        
                        // Agregar respuesta del servidor si existe y es relevante
                        if (error.details.responseText && error.details.responseText.length > 0 && 
                            error.details.responseText.length < 500) {
                            try {
                                const parsed = JSON.parse(error.details.responseText);
                                if (parsed.error || parsed.message) {
                                    errorDetails += `\n\nRespuesta del servidor: ${parsed.error?.message || parsed.message}`;
                                }
                            } catch (e) {
                                // No es JSON, no agregar
                            }
                        }
                    }
                    
                    // Log completo para debugging
                    console.error("❌ [WorkflowService] Error completo capturado:", {
                        message: errorMessage,
                        error: error,
                        details: error.details,
                        stack: error.stack
                    });
                    
                    // Crear error mejorado
                    const enhancedError = new Error(errorMessage);
                    enhancedError.originalError = error;
                    enhancedError.details = error.details;
                    enhancedError.formattedMessage = errorMessage + errorDetails;
                    
                    if (onError) {
                        onError(enhancedError, error.details?.jqXHR);
                    } else {
                        MessageBox.error(
                            errorMessage + errorDetails,
                            {
                                title: "Error al iniciar workflow",
                                details: error.details ? JSON.stringify(error.details, null, 2) : undefined
                            }
                        );
                    }
                    return Promise.reject(enhancedError);
                });
        },

        /**
         * Consulta el estado de una instancia de workflow
         * @param {string} sInstanceId - ID de la instancia del workflow
         * @param {sap.ui.core.Component} oComponent - Componente de la aplicación
         * @returns {Promise} Promesa que se resuelve con el estado del workflow
         */
        getWorkflowInstanceStatus: function (sInstanceId, oComponent) {
            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            return new Promise((resolve, reject) => {
                jQuery.ajax({
                    url: sBaseURL + "/workflow-instances/" + sInstanceId,
                    method: "GET",
                    success: function (result) {
                        resolve(result);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.error("Error al consultar estado del workflow:", errorThrown);
                        reject(new Error("Error al consultar estado: " + errorThrown));
                    }
                });
            });
        }
    };
});
