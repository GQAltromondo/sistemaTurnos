sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    return {
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
        },

        startWorkflowInstance: function (oOptions) {
            const {
                definitionId = "transener.wfturnos",
                context = {},
                oComponent,
                onSuccess,
                onError
            } = oOptions;

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
                        const data = {
                            definitionId: definitionId,
                            context: context
                        };

                        jQuery.ajax({
                            url: sPostURL,
                            method: "POST",
                            contentType: "application/json",
                            timeout: 60000,
                            headers: {
                                "X-CSRF-Token": csrfToken
                            },
                            data: JSON.stringify(data),
                            success: function (result, textStatus, jqXHR) {
                                if (onSuccess) {
                                    onSuccess(result);
                                } else {
                                    MessageToast.show("Workflow iniciado correctamente");
                                }
                                resolve(result);
                            },
                            error: function (jqXHR, textStatus, errorThrown) {
                                let errorMessage = "Error al iniciar el workflow";
                                
                                if (jqXHR && jqXHR.responseText) {
                                    try {
                                        const errorResponse = JSON.parse(jqXHR.responseText);
                                        errorMessage = errorResponse.error?.message || 
                                                      errorResponse.message || 
                                                      errorMessage;
                                    } catch (e) {
                                        errorMessage = errorThrown || textStatus || errorMessage;
                                    }
                                } else {
                                    errorMessage = errorThrown || textStatus || errorMessage;
                                }

                                const error = new Error(errorMessage);
                                
                                if (onError) {
                                    onError(error, jqXHR);
                                } else {
                                    MessageBox.error(errorMessage);
                                }
                                reject(error);
                            }
                        });
                    });
                })
                .catch((error) => {
                    if (onError) {
                        onError(error);
                    } else {
                        MessageBox.error(error.message || "Error al iniciar workflow");
                    }
                    return Promise.reject(error);
                });
        },

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
                        reject(new Error("Error al consultar estado: " + (errorThrown || textStatus)));
                    }
                });
            });
        }
    };
});
