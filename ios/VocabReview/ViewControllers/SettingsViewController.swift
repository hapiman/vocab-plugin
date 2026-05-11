import UIKit

final class SettingsViewController: UIViewController {
    private let store = VocabStore.shared
    private let tokenField = UITextField()
    private let gistIdField = UITextField()
    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        setupViews()
        loadCredentials()
    }

    private func setupViews() {
        tokenField.placeholder = "GitHub Token"
        tokenField.borderStyle = .roundedRect
        tokenField.autocapitalizationType = .none
        tokenField.autocorrectionType = .no
        tokenField.isSecureTextEntry = true

        gistIdField.placeholder = "Gist ID"
        gistIdField.borderStyle = .roundedRect
        gistIdField.autocapitalizationType = .none
        gistIdField.autocorrectionType = .no
        gistIdField.keyboardType = .URL

        let saveButton = UIButton(type: .system)
        saveButton.setTitle("保存设置", for: .normal)
        saveButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        saveButton.backgroundColor = .systemBlue
        saveButton.tintColor = .white
        saveButton.layer.cornerRadius = 8
        saveButton.heightAnchor.constraint(equalToConstant: 46).isActive = true
        saveButton.addTarget(self, action: #selector(saveSettings), for: .touchUpInside)

        let pullButton = UIButton(type: .system)
        pullButton.setTitle("从 Gist 拉取", for: .normal)
        pullButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        pullButton.backgroundColor = .secondarySystemBackground
        pullButton.layer.cornerRadius = 8
        pullButton.heightAnchor.constraint(equalToConstant: 46).isActive = true
        pullButton.addTarget(self, action: #selector(pullGist), for: .touchUpInside)

        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [
            tokenField,
            gistIdField,
            saveButton,
            pullButton,
            statusLabel
        ])
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
    }

    private func loadCredentials() {
        let credentials = store.loadCredentials()
        tokenField.text = credentials.token
        gistIdField.text = credentials.gistId
    }

    @objc private func saveSettings() {
        store.saveCredentials(
            token: tokenField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            gistId: gistIdField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        )
        gistIdField.text = store.loadCredentials().gistId
        statusLabel.text = store.lastError ?? "设置已保存"
    }

    @objc private func pullGist() {
        saveSettings()
        statusLabel.text = "同步中..."
        Task {
            await store.pullFromGist()
            statusLabel.text = store.lastError ?? "拉取成功"
        }
    }
}
