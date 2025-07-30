import React from "react";
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    Trash2,
    Database,
    User,
    Tag,
} from "lucide-react";

const Modal = ({
    isOpen,
    onClose,
    title,
    message,
    type = "info", // info, success, error, warning, confirm
    onConfirm,
    confirmText = "Confirm",
    cancelText = "Cancel",
    showCancel = true,
    icon: CustomIcon,
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        if (CustomIcon) return <CustomIcon className="w-6 h-6" />;

        switch (type) {
            case "success":
                return <CheckCircle className="w-6 h-6 text-green-600" />;
            case "error":
                return <XCircle className="w-6 h-6 text-red-600" />;
            case "warning":
            case "confirm":
                return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
            case "delete":
                return <Trash2 className="w-6 h-6 text-red-600" />;
            default:
                return <Info className="w-6 h-6 text-blue-600" />;
        }
    };

    const getIconBgColor = () => {
        switch (type) {
            case "success":
                return "bg-green-100";
            case "error":
                return "bg-red-100";
            case "warning":
            case "confirm":
                return "bg-yellow-100";
            case "delete":
                return "bg-red-100";
            default:
                return "bg-blue-100";
        }
    };

    const getIconColor = () => {
        switch (type) {
            case "success":
                return "text-green-600";
            case "error":
                return "text-red-600";
            case "warning":
            case "confirm":
                return "text-yellow-600";
            case "delete":
                return "text-red-600";
            default:
                return "text-blue-600";
        }
    };

    const getConfirmButtonColor = () => {
        switch (type) {
            case "success":
                return "bg-green-600 hover:bg-green-700";
            case "error":
                return "bg-red-600 hover:bg-red-700";
            case "warning":
            case "confirm":
                return "bg-yellow-600 hover:bg-yellow-700";
            case "delete":
                return "bg-red-600 hover:bg-red-700";
            default:
                return "bg-blue-600 hover:bg-blue-700";
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all">
                <div className={`flex items-center justify-center w-12 h-12 mx-auto mt-6 rounded-full ${getIconBgColor()}`}>
                    {getIcon()}
                </div>
                <div className="text-center px-6 py-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-600 mb-6">
                        {message}
                    </p>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200"
                        >
                            {cancelText}
                        </button>
                    )}
                    {onConfirm && (
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors duration-200 ${getConfirmButtonColor()}`}
                        >
                            {confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Modal; 